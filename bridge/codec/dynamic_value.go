package codec

import (
	"encoding/json"
	"fmt"
	"math/big"
	"strconv"

	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	"github.com/hashicorp/terraform-plugin-go/tftypes"
)

// JSONToDynamicValue converts a JSON payload into a tfprotov6.DynamicValue
// using the SchemaType for schema-aware msgpack encoding. Absent attributes
// become null; absent blocks follow configschema.NestedBlock.EmptyValue —
// empty collection for List/Set/Map, null for Single, recursively filled
// object for Group — because provider SDKs skip IsNull() guards on blocks.
func JSONToDynamicValue(raw json.RawMessage, st SchemaType) (*tfprotov6.DynamicValue, error) {
	if len(raw) == 0 || string(raw) == "null" {
		val := tftypes.NewValue(st.Type, nil)
		dv, err := tfprotov6.NewDynamicValue(st.Type, val)
		if err != nil {
			return nil, fmt.Errorf("encoding null DynamicValue: %w", err)
		}
		return &dv, nil
	}

	val, err := jsonToValue(raw, st)
	if err != nil {
		return nil, fmt.Errorf("converting JSON to tftypes.Value: %w", err)
	}

	dv, err := tfprotov6.NewDynamicValue(st.Type, val)
	if err != nil {
		return nil, fmt.Errorf("encoding DynamicValue: %w", err)
	}
	return &dv, nil
}

// DynamicValueToJSON converts a tfprotov6.DynamicValue into a JSON payload.
// A nil DynamicValue or a null tftypes.Value produces JSON null.
func DynamicValueToJSON(dv *tfprotov6.DynamicValue, typ tftypes.Type) (json.RawMessage, error) {
	if dv == nil {
		return json.RawMessage("null"), nil
	}

	val, err := dv.Unmarshal(typ)
	if err != nil {
		return nil, fmt.Errorf("unmarshalling DynamicValue: %w", err)
	}

	if !val.IsKnown() || val.IsNull() {
		return json.RawMessage("null"), nil
	}

	raw, err := valueToJSON(val)
	if err != nil {
		return nil, fmt.Errorf("converting tftypes.Value to JSON: %w", err)
	}
	return raw, nil
}

// IdentityDynamicValue builds the tfprotov6 DynamicValue for a resource's
// import identity. Attribute wire types come from the cached identity schema
// (the single authority for identity types); values arrive as user-entered
// strings and are coerced to each attribute's primitive type. Attributes with
// no supplied value encode as null. Terraform constrains identity attributes
// to primitives, so a non-primitive type is a hard error, not a silent guess.
func IdentityDynamicValue(attrTypes map[string]tftypes.Type, values map[string]string) (*tfprotov6.DynamicValue, error) {
	// Reject unknown names here rather than letting them be silently dropped:
	// a typo'd attribute would otherwise null out the real one and trigger a
	// confusing provider-side error during import.
	for name := range values {
		if _, ok := attrTypes[name]; !ok {
			return nil, fmt.Errorf("unknown identity attribute %q", name)
		}
	}
	obj := tftypes.Object{AttributeTypes: attrTypes}
	vals := make(map[string]tftypes.Value, len(attrTypes))
	for name, t := range attrTypes {
		raw, ok := values[name]
		if !ok {
			vals[name] = tftypes.NewValue(t, nil)
			continue
		}
		v, err := stringToPrimitiveValue(t, raw)
		if err != nil {
			return nil, fmt.Errorf("identity attribute %q: %w", name, err)
		}
		vals[name] = v
	}
	dv, err := tfprotov6.NewDynamicValue(obj, tftypes.NewValue(obj, vals))
	if err != nil {
		return nil, fmt.Errorf("encoding identity DynamicValue: %w", err)
	}
	return &dv, nil
}

func stringToPrimitiveValue(t tftypes.Type, s string) (tftypes.Value, error) {
	switch {
	case t.Is(tftypes.String):
		return tftypes.NewValue(tftypes.String, s), nil
	case t.Is(tftypes.Bool):
		b, err := strconv.ParseBool(s)
		if err != nil {
			return tftypes.Value{}, fmt.Errorf("expected a boolean, got %q", s)
		}
		return tftypes.NewValue(tftypes.Bool, b), nil
	case t.Is(tftypes.Number):
		bf, ok := new(big.Float).SetString(s)
		if !ok {
			return tftypes.Value{}, fmt.Errorf("expected a number, got %q", s)
		}
		return tftypes.NewValue(tftypes.Number, bf), nil
	default:
		return tftypes.Value{}, fmt.Errorf("unsupported identity attribute type %s; this resource needs a raw import ID instead", t)
	}
}

// blockElementMarker is a sentinel key in SchemaType.Blocks that carries the
// inner block metadata across a collection boundary, so elementType can
// recover it when recursing into list/set/map items. Starts with NUL so it
// cannot collide with any real Terraform identifier.
const blockElementMarker = "\x00element"

func (st SchemaType) childType(attrName string, attrType tftypes.Type) SchemaType {
	block, isBlock := st.Blocks[attrName]
	if !isBlock {
		return SchemaType{Type: attrType}
	}
	switch block.Nesting {
	case tfprotov6.SchemaNestedBlockNestingModeSingle,
		tfprotov6.SchemaNestedBlockNestingModeGroup:
		return block.Inner
	}
	return SchemaType{Type: attrType, Blocks: map[string]BlockInfo{blockElementMarker: block}}
}

func (st SchemaType) elementType() SchemaType {
	if block, ok := st.Blocks[blockElementMarker]; ok {
		return block.Inner
	}
	switch t := st.Type.(type) {
	case tftypes.List:
		return SchemaType{Type: t.ElementType}
	case tftypes.Set:
		return SchemaType{Type: t.ElementType}
	case tftypes.Map:
		return SchemaType{Type: t.ElementType}
	}
	return SchemaType{Type: st.Type}
}

// absentBlockValue returns the value an absent block encodes to, per its
// nesting mode. Mirrors Terraform core's configschema.NestedBlock.EmptyValue:
// a List/Set absent is an empty collection; Map absent is an empty map;
// Single absent is null (the one nesting mode where null is allowed); Group
// absent is an object recursively filled with each inner attr's absent value
// because a Group block is always present in state. The []/map[] literals
// below also fit Tuple/Object for the dynamic-pseudo-type fallback where
// schema.go swaps List→Tuple and Map→Object.
func absentBlockValue(attrType tftypes.Type, block BlockInfo) tftypes.Value {
	switch block.Nesting {
	case tfprotov6.SchemaNestedBlockNestingModeList,
		tfprotov6.SchemaNestedBlockNestingModeSet:
		return tftypes.NewValue(attrType, []tftypes.Value{})
	case tfprotov6.SchemaNestedBlockNestingModeMap:
		return tftypes.NewValue(attrType, map[string]tftypes.Value{})
	case tfprotov6.SchemaNestedBlockNestingModeGroup:
		return groupAbsentValue(attrType, block.Inner)
	}
	return tftypes.NewValue(attrType, nil)
}

func groupAbsentValue(attrType tftypes.Type, inner SchemaType) tftypes.Value {
	ot, ok := attrType.(tftypes.Object)
	if !ok {
		return tftypes.NewValue(attrType, nil)
	}
	vals := make(map[string]tftypes.Value, len(ot.AttributeTypes))
	for name, t := range ot.AttributeTypes {
		if block, isBlock := inner.Blocks[name]; isBlock {
			vals[name] = absentBlockValue(t, block)
			continue
		}
		vals[name] = tftypes.NewValue(t, nil)
	}
	return tftypes.NewValue(ot, vals)
}

// jsonToValue converts a raw JSON message to a tftypes.Value of the given type.
// tftypes primitives (String, Number, Bool, DynamicPseudoType) are singleton
// values, not Go types, so we use Is() for dispatch.
func jsonToValue(raw json.RawMessage, st SchemaType) (tftypes.Value, error) {
	null := string(raw) == "null"
	typ := st.Type

	switch {
	case typ.Is(tftypes.String):
		if null {
			return tftypes.NewValue(tftypes.String, nil), nil
		}
		var s string
		if err := json.Unmarshal(raw, &s); err != nil {
			return tftypes.Value{}, fmt.Errorf("parsing string: %w", err)
		}
		return tftypes.NewValue(tftypes.String, s), nil

	case typ.Is(tftypes.Number):
		if null {
			return tftypes.NewValue(tftypes.Number, nil), nil
		}
		var n json.Number
		if err := json.Unmarshal(raw, &n); err != nil {
			return tftypes.Value{}, fmt.Errorf("parsing number: %w", err)
		}
		bf := new(big.Float)
		if _, ok := bf.SetString(n.String()); !ok {
			return tftypes.Value{}, fmt.Errorf("converting number %q to big.Float", n.String())
		}
		return tftypes.NewValue(tftypes.Number, bf), nil

	case typ.Is(tftypes.Bool):
		if null {
			return tftypes.NewValue(tftypes.Bool, nil), nil
		}
		var b bool
		if err := json.Unmarshal(raw, &b); err != nil {
			return tftypes.Value{}, fmt.Errorf("parsing bool: %w", err)
		}
		return tftypes.NewValue(tftypes.Bool, b), nil

	case typ.Is(tftypes.DynamicPseudoType):
		if null {
			return tftypes.NewValue(tftypes.DynamicPseudoType, nil), nil
		}
		return tftypes.NewValue(tftypes.DynamicPseudoType, tftypes.UnknownValue), nil

	case typ.Is(tftypes.Object{}):
		t := typ.(tftypes.Object)
		if null {
			return tftypes.NewValue(t, nil), nil
		}
		var m map[string]json.RawMessage
		if err := json.Unmarshal(raw, &m); err != nil {
			return tftypes.Value{}, fmt.Errorf("parsing object: %w", err)
		}
		vals := make(map[string]tftypes.Value, len(t.AttributeTypes))
		for k, attrType := range t.AttributeTypes {
			attrRaw, exists := m[k]
			if !exists {
				if block, isBlock := st.Blocks[k]; isBlock {
					vals[k] = absentBlockValue(attrType, block)
					continue
				}
				vals[k] = tftypes.NewValue(attrType, nil)
				continue
			}
			v, err := jsonToValue(attrRaw, st.childType(k, attrType))
			if err != nil {
				return tftypes.Value{}, fmt.Errorf("attribute %q: %w", k, err)
			}
			vals[k] = v
		}
		return tftypes.NewValue(t, vals), nil

	case typ.Is(tftypes.List{}):
		t := typ.(tftypes.List)
		if null {
			return tftypes.NewValue(t, nil), nil
		}
		var items []json.RawMessage
		if err := json.Unmarshal(raw, &items); err != nil {
			return tftypes.Value{}, fmt.Errorf("parsing list: %w", err)
		}
		elem := st.elementType()
		vals := make([]tftypes.Value, len(items))
		for i, item := range items {
			v, err := jsonToValue(item, elem)
			if err != nil {
				return tftypes.Value{}, fmt.Errorf("list[%d]: %w", i, err)
			}
			vals[i] = v
		}
		return tftypes.NewValue(t, vals), nil

	case typ.Is(tftypes.Set{}):
		t := typ.(tftypes.Set)
		if null {
			return tftypes.NewValue(t, nil), nil
		}
		var items []json.RawMessage
		if err := json.Unmarshal(raw, &items); err != nil {
			return tftypes.Value{}, fmt.Errorf("parsing set: %w", err)
		}
		elem := st.elementType()
		vals := make([]tftypes.Value, len(items))
		for i, item := range items {
			v, err := jsonToValue(item, elem)
			if err != nil {
				return tftypes.Value{}, fmt.Errorf("set[%d]: %w", i, err)
			}
			vals[i] = v
		}
		return tftypes.NewValue(t, vals), nil

	case typ.Is(tftypes.Map{}):
		t := typ.(tftypes.Map)
		if null {
			return tftypes.NewValue(t, nil), nil
		}
		var m map[string]json.RawMessage
		if err := json.Unmarshal(raw, &m); err != nil {
			return tftypes.Value{}, fmt.Errorf("parsing map: %w", err)
		}
		elem := st.elementType()
		vals := make(map[string]tftypes.Value)
		for k, v := range m {
			val, err := jsonToValue(v, elem)
			if err != nil {
				return tftypes.Value{}, fmt.Errorf("map[%q]: %w", k, err)
			}
			vals[k] = val
		}
		return tftypes.NewValue(t, vals), nil

	case typ.Is(tftypes.Tuple{}):
		t := typ.(tftypes.Tuple)
		if null {
			return tftypes.NewValue(t, nil), nil
		}
		var items []json.RawMessage
		if err := json.Unmarshal(raw, &items); err != nil {
			return tftypes.Value{}, fmt.Errorf("parsing tuple: %w", err)
		}
		if len(items) != len(t.ElementTypes) {
			return tftypes.Value{}, fmt.Errorf("tuple length mismatch: got %d, want %d", len(items), len(t.ElementTypes))
		}
		vals := make([]tftypes.Value, len(items))
		for i, item := range items {
			v, err := jsonToValue(item, SchemaType{Type: t.ElementTypes[i]})
			if err != nil {
				return tftypes.Value{}, fmt.Errorf("tuple[%d]: %w", i, err)
			}
			vals[i] = v
		}
		return tftypes.NewValue(t, vals), nil

	default:
		return tftypes.Value{}, fmt.Errorf("unsupported type %T", typ)
	}
}

// valueToJSON converts a tftypes.Value to a JSON raw message.
func valueToJSON(val tftypes.Value) (json.RawMessage, error) {
	if !val.IsKnown() || val.IsNull() {
		return json.RawMessage("null"), nil
	}

	typ := val.Type()

	switch {
	case typ.Is(tftypes.String):
		var s string
		if err := val.As(&s); err != nil {
			return nil, fmt.Errorf("reading string: %w", err)
		}
		return json.Marshal(s)

	case typ.Is(tftypes.Number):
		var bf *big.Float
		if err := val.As(&bf); err != nil {
			return nil, fmt.Errorf("reading number: %w", err)
		}
		// Preserve full precision: integers as decimal strings, floats using
		// big.Float's shortest exact representation. Avoid float64 conversion
		// which would lose precision for numbers outside its range.
		if bf.IsInt() {
			i, _ := bf.Int(nil)
			return []byte(i.String()), nil
		}
		return []byte(bf.Text('f', -1)), nil

	case typ.Is(tftypes.Bool):
		var b bool
		if err := val.As(&b); err != nil {
			return nil, fmt.Errorf("reading bool: %w", err)
		}
		return json.Marshal(b)

	case typ.Is(tftypes.Object{}):
		var m map[string]tftypes.Value
		if err := val.As(&m); err != nil {
			return nil, fmt.Errorf("reading object: %w", err)
		}
		out := make(map[string]json.RawMessage, len(m))
		for k, v := range m {
			raw, err := valueToJSON(v)
			if err != nil {
				return nil, fmt.Errorf("attribute %q: %w", k, err)
			}
			out[k] = raw
		}
		return json.Marshal(out)

	case typ.Is(tftypes.List{}), typ.Is(tftypes.Set{}), typ.Is(tftypes.Tuple{}):
		var items []tftypes.Value
		if err := val.As(&items); err != nil {
			return nil, fmt.Errorf("reading list/set/tuple: %w", err)
		}
		out := make([]json.RawMessage, len(items))
		for i, item := range items {
			raw, err := valueToJSON(item)
			if err != nil {
				return nil, fmt.Errorf("[%d]: %w", i, err)
			}
			out[i] = raw
		}
		return json.Marshal(out)

	case typ.Is(tftypes.Map{}):
		var m map[string]tftypes.Value
		if err := val.As(&m); err != nil {
			return nil, fmt.Errorf("reading map: %w", err)
		}
		out := make(map[string]json.RawMessage, len(m))
		for k, v := range m {
			raw, err := valueToJSON(v)
			if err != nil {
				return nil, fmt.Errorf("map[%q]: %w", k, err)
			}
			out[k] = raw
		}
		return json.Marshal(out)

	default:
		return json.RawMessage("null"), nil
	}
}
