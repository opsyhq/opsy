package codec_test

import (
	"encoding/json"
	"math/big"
	"strings"
	"testing"

	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	"github.com/hashicorp/terraform-plugin-go/tftypes"
	"github.com/opsydev/opsy/bridge/codec"
)

func flat(t tftypes.Type) codec.SchemaType { return codec.SchemaType{Type: t} }

func TestJSONRoundTrip_String(t *testing.T) {
	st := flat(tftypes.String)
	raw := json.RawMessage(`"hello"`)

	dv, err := codec.JSONToDynamicValue(raw, st)
	if err != nil {
		t.Fatalf("JSONToDynamicValue: %v", err)
	}
	got, err := codec.DynamicValueToJSON(dv, st.Type)
	if err != nil {
		t.Fatalf("DynamicValueToJSON: %v", err)
	}
	if string(got) != `"hello"` {
		t.Errorf("got %s, want %q", got, "hello")
	}
}

func TestJSONRoundTrip_Number(t *testing.T) {
	st := flat(tftypes.Number)
	for _, tc := range []struct{ in, want string }{
		{`42`, `42`},
		{`3.14`, `3.14`},
		{`0`, `0`},
	} {
		dv, err := codec.JSONToDynamicValue(json.RawMessage(tc.in), st)
		if err != nil {
			t.Fatalf("input %s: JSONToDynamicValue: %v", tc.in, err)
		}
		got, err := codec.DynamicValueToJSON(dv, st.Type)
		if err != nil {
			t.Fatalf("input %s: DynamicValueToJSON: %v", tc.in, err)
		}
		if string(got) != tc.want {
			t.Errorf("input %s: got %s, want %s", tc.in, got, tc.want)
		}
	}
}

func TestJSONRoundTrip_Bool(t *testing.T) {
	st := flat(tftypes.Bool)
	for _, v := range []string{"true", "false"} {
		dv, err := codec.JSONToDynamicValue(json.RawMessage(v), st)
		if err != nil {
			t.Fatalf("%s: JSONToDynamicValue: %v", v, err)
		}
		got, err := codec.DynamicValueToJSON(dv, st.Type)
		if err != nil {
			t.Fatalf("%s: DynamicValueToJSON: %v", v, err)
		}
		if string(got) != v {
			t.Errorf("got %s, want %s", got, v)
		}
	}
}

func TestJSONRoundTrip_Null(t *testing.T) {
	st := flat(tftypes.String)
	dv, err := codec.JSONToDynamicValue(json.RawMessage("null"), st)
	if err != nil {
		t.Fatalf("JSONToDynamicValue: %v", err)
	}
	got, err := codec.DynamicValueToJSON(dv, st.Type)
	if err != nil {
		t.Fatalf("DynamicValueToJSON: %v", err)
	}
	if string(got) != "null" {
		t.Errorf("got %s, want null", got)
	}
}

func TestJSONRoundTrip_Object(t *testing.T) {
	st := flat(tftypes.Object{
		AttributeTypes: map[string]tftypes.Type{
			"name":    tftypes.String,
			"count":   tftypes.Number,
			"enabled": tftypes.Bool,
		},
	})
	raw := json.RawMessage(`{"name":"test","count":3,"enabled":true}`)

	dv, err := codec.JSONToDynamicValue(raw, st)
	if err != nil {
		t.Fatalf("JSONToDynamicValue: %v", err)
	}
	got, err := codec.DynamicValueToJSON(dv, st.Type)
	if err != nil {
		t.Fatalf("DynamicValueToJSON: %v", err)
	}

	var gotMap, wantMap map[string]any
	json.Unmarshal(got, &gotMap)
	json.Unmarshal(raw, &wantMap)
	if gotMap["name"] != wantMap["name"] {
		t.Errorf("name: got %v, want %v", gotMap["name"], wantMap["name"])
	}
}

func TestJSONRoundTrip_List(t *testing.T) {
	st := flat(tftypes.List{ElementType: tftypes.String})
	raw := json.RawMessage(`["a","b","c"]`)

	dv, err := codec.JSONToDynamicValue(raw, st)
	if err != nil {
		t.Fatalf("JSONToDynamicValue: %v", err)
	}
	got, err := codec.DynamicValueToJSON(dv, st.Type)
	if err != nil {
		t.Fatalf("DynamicValueToJSON: %v", err)
	}
	if string(got) != `["a","b","c"]` {
		t.Errorf("got %s, want [\"a\",\"b\",\"c\"]", got)
	}
}

func TestJSONRoundTrip_Map(t *testing.T) {
	st := flat(tftypes.Map{ElementType: tftypes.Number})
	raw := json.RawMessage(`{"x":1,"y":2}`)

	dv, err := codec.JSONToDynamicValue(raw, st)
	if err != nil {
		t.Fatalf("JSONToDynamicValue: %v", err)
	}
	got, err := codec.DynamicValueToJSON(dv, st.Type)
	if err != nil {
		t.Fatalf("DynamicValueToJSON: %v", err)
	}

	var gotMap, wantMap map[string]any
	json.Unmarshal(got, &gotMap)
	json.Unmarshal(raw, &wantMap)
	if len(gotMap) != len(wantMap) {
		t.Errorf("map length: got %d, want %d", len(gotMap), len(wantMap))
	}
}

func blockSchema(nesting tfprotov6.SchemaNestedBlockNestingMode) *tfprotov6.Schema {
	return &tfprotov6.Schema{
		Block: &tfprotov6.SchemaBlock{
			Attributes: []*tfprotov6.SchemaAttribute{
				{Name: "name", Type: tftypes.String, Optional: true},
			},
			BlockTypes: []*tfprotov6.SchemaNestedBlock{
				{
					TypeName: "device",
					Nesting:  nesting,
					Block: &tfprotov6.SchemaBlock{
						Attributes: []*tfprotov6.SchemaAttribute{
							{Name: "size", Type: tftypes.Number, Optional: true},
						},
					},
				},
			},
		},
	}
}

// deviceValue extracts the encoded "device" attribute as a tftypes.Value.
func deviceValue(t *testing.T, st codec.SchemaType, input string) tftypes.Value {
	t.Helper()
	dv, err := codec.JSONToDynamicValue(json.RawMessage(input), st)
	if err != nil {
		t.Fatalf("JSONToDynamicValue: %v", err)
	}
	val, err := dv.Unmarshal(st.Type)
	if err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	var m map[string]tftypes.Value
	if err := val.As(&m); err != nil {
		t.Fatalf("val.As: %v", err)
	}
	return m["device"]
}

func TestAbsentBlock_NestingList_EncodesEmptyList(t *testing.T) {
	st := codec.SchemaToType(blockSchema(tfprotov6.SchemaNestedBlockNestingModeList))
	dev := deviceValue(t, st, `{"name":"foo"}`)
	if dev.IsNull() {
		t.Fatalf("absent NestingList block must be empty list, got null")
	}
	var items []tftypes.Value
	if err := dev.As(&items); err != nil {
		t.Fatalf("dev.As: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("want empty list, got %d items", len(items))
	}
}

func TestAbsentBlock_NestingSet_EncodesEmptySet(t *testing.T) {
	st := codec.SchemaToType(blockSchema(tfprotov6.SchemaNestedBlockNestingModeSet))
	dev := deviceValue(t, st, `{"name":"foo"}`)
	if dev.IsNull() {
		t.Fatalf("absent NestingSet block must be empty set, got null")
	}
	var items []tftypes.Value
	if err := dev.As(&items); err != nil {
		t.Fatalf("dev.As: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("want empty set, got %d items", len(items))
	}
}

func TestAbsentBlock_NestingMap_EncodesEmptyMap(t *testing.T) {
	st := codec.SchemaToType(blockSchema(tfprotov6.SchemaNestedBlockNestingModeMap))
	dev := deviceValue(t, st, `{"name":"foo"}`)
	if dev.IsNull() {
		t.Fatalf("absent NestingMap block must be empty map, got null")
	}
	var items map[string]tftypes.Value
	if err := dev.As(&items); err != nil {
		t.Fatalf("dev.As: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("want empty map, got %d items", len(items))
	}
}

func TestAbsentBlock_NestingSingle_EncodesNull(t *testing.T) {
	// Single is the one nesting mode where null is allowed — it matches HCL
	// semantics for an omitted optional single block.
	st := codec.SchemaToType(blockSchema(tfprotov6.SchemaNestedBlockNestingModeSingle))
	dev := deviceValue(t, st, `{"name":"foo"}`)
	if !dev.IsNull() {
		t.Errorf("absent NestingSingle block should be null, got non-null %v", dev)
	}
}

func TestAbsentBlock_NestingGroup_FillsInnerAttrsNull(t *testing.T) {
	// Group blocks are always present with inner attrs at their absent value.
	st := codec.SchemaToType(blockSchema(tfprotov6.SchemaNestedBlockNestingModeGroup))
	dev := deviceValue(t, st, `{"name":"foo"}`)
	if dev.IsNull() {
		t.Fatalf("NestingGroup block must be object with null inner attrs, got null")
	}
	var inner map[string]tftypes.Value
	if err := dev.As(&inner); err != nil {
		t.Fatalf("dev.As: %v", err)
	}
	size, ok := inner["size"]
	if !ok {
		t.Fatalf("inner attr size missing")
	}
	if !size.IsNull() {
		t.Errorf("inner attr size should be null, got %v", size)
	}
}

func TestAbsentBlock_NestingGroup_RecursesIntoInnerBlock(t *testing.T) {
	// A Group block whose body contains another (List) block. Verifies that
	// group recursion doesn't stop at attributes — the inner List block must
	// still encode as an empty list, not null, or providers panic one level
	// deeper.
	schema := &tfprotov6.Schema{
		Block: &tfprotov6.SchemaBlock{
			BlockTypes: []*tfprotov6.SchemaNestedBlock{
				{
					TypeName: "outer",
					Nesting:  tfprotov6.SchemaNestedBlockNestingModeGroup,
					Block: &tfprotov6.SchemaBlock{
						BlockTypes: []*tfprotov6.SchemaNestedBlock{
							{
								TypeName: "inner",
								Nesting:  tfprotov6.SchemaNestedBlockNestingModeList,
								Block:    &tfprotov6.SchemaBlock{},
							},
						},
					},
				},
			},
		},
	}
	st := codec.SchemaToType(schema)
	dv, err := codec.JSONToDynamicValue(json.RawMessage(`{}`), st)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	val, _ := dv.Unmarshal(st.Type)
	var root map[string]tftypes.Value
	_ = val.As(&root)
	if root["outer"].IsNull() {
		t.Fatalf("outer group block must not be null")
	}
	var outer map[string]tftypes.Value
	_ = root["outer"].As(&outer)
	if outer["inner"].IsNull() {
		t.Fatalf("inner list block inside group must be empty list, not null")
	}
	var items []tftypes.Value
	_ = outer["inner"].As(&items)
	if len(items) != 0 {
		t.Errorf("want empty list, got %d items", len(items))
	}
}

func nestedAttrSchema(nesting tfprotov6.SchemaObjectNestingMode) *tfprotov6.Schema {
	return &tfprotov6.Schema{
		Block: &tfprotov6.SchemaBlock{
			Attributes: []*tfprotov6.SchemaAttribute{
				{
					Name:     "items",
					Optional: true,
					NestedType: &tfprotov6.SchemaObject{
						Nesting: nesting,
						Attributes: []*tfprotov6.SchemaAttribute{
							{Name: "name", Type: tftypes.String, Optional: true},
						},
					},
				},
			},
		},
	}
}

func TestNestedAttribute_Single_Type(t *testing.T) {
	st := codec.SchemaToType(nestedAttrSchema(tfprotov6.SchemaObjectNestingModeSingle))
	obj := st.Type.(tftypes.Object)
	if !obj.AttributeTypes["items"].Is(tftypes.Object{}) {
		t.Errorf("Single nested attr should be Object, got %v", obj.AttributeTypes["items"])
	}
}

func TestNestedAttribute_List_Type(t *testing.T) {
	st := codec.SchemaToType(nestedAttrSchema(tfprotov6.SchemaObjectNestingModeList))
	obj := st.Type.(tftypes.Object)
	got, ok := obj.AttributeTypes["items"].(tftypes.List)
	if !ok {
		t.Fatalf("List nested attr should be List, got %T", obj.AttributeTypes["items"])
	}
	if !got.ElementType.Is(tftypes.Object{}) {
		t.Errorf("element should be Object, got %v", got.ElementType)
	}
}

func TestNestedAttribute_Set_Type(t *testing.T) {
	st := codec.SchemaToType(nestedAttrSchema(tfprotov6.SchemaObjectNestingModeSet))
	obj := st.Type.(tftypes.Object)
	if _, ok := obj.AttributeTypes["items"].(tftypes.Set); !ok {
		t.Errorf("Set nested attr should be Set, got %T", obj.AttributeTypes["items"])
	}
}

func TestNestedAttribute_Map_Type(t *testing.T) {
	st := codec.SchemaToType(nestedAttrSchema(tfprotov6.SchemaObjectNestingModeMap))
	obj := st.Type.(tftypes.Object)
	if _, ok := obj.AttributeTypes["items"].(tftypes.Map); !ok {
		t.Errorf("Map nested attr should be Map, got %T", obj.AttributeTypes["items"])
	}
}

func TestNestedAttribute_AbsentEncodesNull(t *testing.T) {
	// Nested attribute absent from config → null on the wire (attribute
	// semantics). Provider SDKs handle null lists/objects for attrs.
	st := codec.SchemaToType(nestedAttrSchema(tfprotov6.SchemaObjectNestingModeList))
	dv, err := codec.JSONToDynamicValue(json.RawMessage(`{}`), st)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	val, _ := dv.Unmarshal(st.Type)
	var root map[string]tftypes.Value
	_ = val.As(&root)
	if !root["items"].IsNull() {
		t.Errorf("absent nested attribute should be null, got %v", root["items"])
	}
}

func TestNestedAttribute_PresentDecodes(t *testing.T) {
	// Present list-nested attribute with one item round-trips cleanly.
	st := codec.SchemaToType(nestedAttrSchema(tfprotov6.SchemaObjectNestingModeList))
	dv, err := codec.JSONToDynamicValue(json.RawMessage(`{"items":[{"name":"x"}]}`), st)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	val, _ := dv.Unmarshal(st.Type)
	var root map[string]tftypes.Value
	_ = val.As(&root)
	var items []tftypes.Value
	_ = root["items"].As(&items)
	if len(items) != 1 {
		t.Fatalf("want 1 item, got %d", len(items))
	}
}

func TestNestedAttribute_Recursive(t *testing.T) {
	// NestedType inside NestedType — framework-style nested nested attrs.
	schema := &tfprotov6.Schema{
		Block: &tfprotov6.SchemaBlock{
			Attributes: []*tfprotov6.SchemaAttribute{
				{
					Name:     "outer",
					Optional: true,
					NestedType: &tfprotov6.SchemaObject{
						Nesting: tfprotov6.SchemaObjectNestingModeList,
						Attributes: []*tfprotov6.SchemaAttribute{
							{
								Name:     "inner",
								Optional: true,
								NestedType: &tfprotov6.SchemaObject{
									Nesting: tfprotov6.SchemaObjectNestingModeSingle,
									Attributes: []*tfprotov6.SchemaAttribute{
										{Name: "value", Type: tftypes.String, Optional: true},
									},
								},
							},
						},
					},
				},
			},
		},
	}
	st := codec.SchemaToType(schema)
	outerList, ok := st.Type.(tftypes.Object).AttributeTypes["outer"].(tftypes.List)
	if !ok {
		t.Fatalf("outer should be List")
	}
	elem, ok := outerList.ElementType.(tftypes.Object)
	if !ok {
		t.Fatalf("outer element should be Object")
	}
	if _, ok := elem.AttributeTypes["inner"].(tftypes.Object); !ok {
		t.Errorf("inner (Single nested attr) should be Object, got %T", elem.AttributeTypes["inner"])
	}
}

func dynamicBlockSchema(nesting tfprotov6.SchemaNestedBlockNestingMode) *tfprotov6.Schema {
	return &tfprotov6.Schema{
		Block: &tfprotov6.SchemaBlock{
			BlockTypes: []*tfprotov6.SchemaNestedBlock{
				{
					TypeName: "dyn",
					Nesting:  nesting,
					Block: &tfprotov6.SchemaBlock{
						Attributes: []*tfprotov6.SchemaAttribute{
							{Name: "any", Type: tftypes.DynamicPseudoType, Optional: true},
						},
					},
				},
			},
		},
	}
}

func TestDynamicBlock_NestingList_OuterIsTuple(t *testing.T) {
	st := codec.SchemaToType(dynamicBlockSchema(tfprotov6.SchemaNestedBlockNestingModeList))
	got := st.Type.(tftypes.Object).AttributeTypes["dyn"]
	if _, ok := got.(tftypes.Tuple); !ok {
		t.Fatalf("List block with dynamic inner should have Tuple outer, got %T", got)
	}
	dv, err := codec.JSONToDynamicValue(json.RawMessage(`{}`), st)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	val, _ := dv.Unmarshal(st.Type)
	var root map[string]tftypes.Value
	_ = val.As(&root)
	if root["dyn"].IsNull() {
		t.Fatalf("absent dynamic block should be empty tuple, got null")
	}
}

func TestDynamicBlock_NestingMap_OuterIsObject(t *testing.T) {
	st := codec.SchemaToType(dynamicBlockSchema(tfprotov6.SchemaNestedBlockNestingModeMap))
	got := st.Type.(tftypes.Object).AttributeTypes["dyn"]
	if _, ok := got.(tftypes.Object); !ok {
		t.Fatalf("Map block with dynamic inner should have Object outer, got %T", got)
	}
	dv, err := codec.JSONToDynamicValue(json.RawMessage(`{}`), st)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	val, _ := dv.Unmarshal(st.Type)
	var root map[string]tftypes.Value
	_ = val.As(&root)
	if root["dyn"].IsNull() {
		t.Fatalf("absent dynamic block should be empty object, got null")
	}
}

func TestPresentBlock_NestingList_PreservesItems(t *testing.T) {
	st := codec.SchemaToType(blockSchema(tfprotov6.SchemaNestedBlockNestingModeList))
	dev := deviceValue(t, st, `{"name":"foo","device":[{"size":10}]}`)
	if dev.IsNull() {
		t.Fatalf("present block must not be null")
	}
	var items []tftypes.Value
	if err := dev.As(&items); err != nil {
		t.Fatalf("dev.As: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("want 1 item, got %d", len(items))
	}
	var inner map[string]tftypes.Value
	if err := items[0].As(&inner); err != nil {
		t.Fatalf("item.As: %v", err)
	}
	if inner["size"].IsNull() {
		t.Error("inner size should be 10, got null")
	}
}

func TestIdentityDynamicValue_CoercesPrimitivesAndAbsentNull(t *testing.T) {
	attrTypes := map[string]tftypes.Type{
		"bucket":  tftypes.String,
		"enabled": tftypes.Bool,
		"port":    tftypes.Number,
		"region":  tftypes.String, // omitted by caller → encodes null
	}
	dv, err := codec.IdentityDynamicValue(attrTypes, map[string]string{
		"bucket":  "my-bucket",
		"enabled": "true",
		"port":    "443",
	})
	if err != nil {
		t.Fatalf("IdentityDynamicValue: %v", err)
	}

	val, err := dv.Unmarshal(tftypes.Object{AttributeTypes: attrTypes})
	if err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	var m map[string]tftypes.Value
	if err := val.As(&m); err != nil {
		t.Fatalf("val.As: %v", err)
	}

	var bucket string
	if err := m["bucket"].As(&bucket); err != nil || bucket != "my-bucket" {
		t.Errorf("bucket = %q (err %v), want %q", bucket, err, "my-bucket")
	}
	var enabled bool
	if err := m["enabled"].As(&enabled); err != nil || !enabled {
		t.Errorf("enabled = %v (err %v), want true", enabled, err)
	}
	var port *big.Float
	if err := m["port"].As(&port); err != nil || port.Cmp(big.NewFloat(443)) != 0 {
		t.Errorf("port = %v (err %v), want 443", port, err)
	}
	if !m["region"].IsNull() {
		t.Error("omitted region should encode as null")
	}
}

func TestIdentityDynamicValue_RejectsUnknownAttribute(t *testing.T) {
	_, err := codec.IdentityDynamicValue(
		map[string]tftypes.Type{"bucket": tftypes.String},
		map[string]string{"bukcet": "typo"},
	)
	if err == nil || !strings.Contains(err.Error(), `unknown identity attribute "bukcet"`) {
		t.Fatalf("want unknown-attribute error, got %v", err)
	}
}

func TestIdentityDynamicValue_RejectsNonPrimitiveType(t *testing.T) {
	_, err := codec.IdentityDynamicValue(
		map[string]tftypes.Type{"tags": tftypes.List{ElementType: tftypes.String}},
		map[string]string{"tags": "a,b"},
	)
	if err == nil || !strings.Contains(err.Error(), "needs a raw import ID") {
		t.Fatalf("want unsupported-type error, got %v", err)
	}
}

func TestIdentityDynamicValue_RejectsMalformedPrimitive(t *testing.T) {
	_, err := codec.IdentityDynamicValue(
		map[string]tftypes.Type{"port": tftypes.Number},
		map[string]string{"port": "not-a-number"},
	)
	if err == nil || !strings.Contains(err.Error(), "expected a number") {
		t.Fatalf("want number-parse error, got %v", err)
	}
}
