package codec

import (
	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	"github.com/hashicorp/terraform-plugin-go/tftypes"
)

// SchemaType pairs a tftypes.Type with enough schema metadata for the encoder
// to distinguish blocks from attributes. Terraform's plugin protocol treats
// them differently on the wire: an absent optional attribute is null, but an
// absent block is an empty collection (NestingList/Set/Map), null object
// (NestingSingle), or an object with every inner attribute at its absent
// value (NestingGroup). Provider SDKs rely on this invariant — many resource
// Read paths assume blocks are never null and call LengthInt / ElementIterator
// without a guard. Emitting null for a block therefore panics the plugin.
//
// tftypes.Type alone flattens this distinction (a list-typed block and a
// list-typed attribute both show up as tftypes.List). SchemaType carries the
// block map alongside so the encoder can do the right thing.
type SchemaType struct {
	// Type is the wire type for this position.
	Type tftypes.Type

	// Blocks, populated only when Type is a tftypes.Object, maps an attribute
	// name from Type.AttributeTypes to its block metadata. Attribute names
	// that come from SchemaBlock.Attributes are absent from this map —
	// nested-attribute types follow attribute semantics (absent = null).
	Blocks map[string]BlockInfo
}

// BlockInfo describes one nested block's nesting mode and the SchemaType of
// its inner object (the block body). Inner.Type is always tftypes.Object —
// for List/Set/Map nesting it is the element type, not the outer collection.
type BlockInfo struct {
	Nesting tfprotov6.SchemaNestedBlockNestingMode
	Inner   SchemaType
}

// SchemaToType converts a provider/resource/datasource schema into the
// SchemaType the codec needs to encode JSON configs correctly.
func SchemaToType(schema *tfprotov6.Schema) SchemaType {
	if schema == nil || schema.Block == nil {
		return SchemaType{Type: tftypes.Object{}}
	}
	return blockToSchemaType(schema.Block)
}

// blockToSchemaType walks a SchemaBlock and produces the matching SchemaType.
// Attributes contribute flat entries to AttributeTypes (respecting NestedType
// for framework-style nested attributes). Nested blocks wrap their inner
// object per nesting mode, with the TF-core DynamicPseudoType fallback:
// List → Tuple, Map → Object when the inner has any dynamic pseudo-type.
func blockToSchemaType(block *tfprotov6.SchemaBlock) SchemaType {
	attrTypes := make(map[string]tftypes.Type)
	blocks := make(map[string]BlockInfo)

	for _, attr := range block.Attributes {
		attrTypes[attr.Name] = attributeType(attr)
	}

	for _, nb := range block.BlockTypes {
		inner := blockToSchemaType(nb.Block)
		var outer tftypes.Type
		switch nb.Nesting {
		case tfprotov6.SchemaNestedBlockNestingModeSingle,
			tfprotov6.SchemaNestedBlockNestingModeGroup:
			outer = inner.Type
		case tfprotov6.SchemaNestedBlockNestingModeList:
			if hasDynamic(inner.Type) {
				outer = tftypes.Tuple{ElementTypes: nil}
			} else {
				outer = tftypes.List{ElementType: inner.Type}
			}
		case tfprotov6.SchemaNestedBlockNestingModeSet:
			outer = tftypes.Set{ElementType: inner.Type}
		case tfprotov6.SchemaNestedBlockNestingModeMap:
			if hasDynamic(inner.Type) {
				outer = tftypes.Object{AttributeTypes: nil}
			} else {
				outer = tftypes.Map{ElementType: inner.Type}
			}
		default:
			outer = inner.Type
		}
		attrTypes[nb.TypeName] = outer
		blocks[nb.TypeName] = BlockInfo{Nesting: nb.Nesting, Inner: inner}
	}

	return SchemaType{
		Type:   tftypes.Object{AttributeTypes: attrTypes},
		Blocks: blocks,
	}
}

// attributeType resolves a SchemaAttribute to its wire type. Framework-style
// nested attributes (NestedType != nil) describe a SchemaObject that wraps
// its inner attrs per its own NestingMode. Nested attributes follow
// attribute semantics — absent = null — so they contribute no BlockInfo.
func attributeType(attr *tfprotov6.SchemaAttribute) tftypes.Type {
	if attr.NestedType != nil {
		return nestedObjectType(attr.NestedType)
	}
	return attr.Type
}

// nestedObjectType mirrors Terraform core's configschema.Object.specType:
// build the inner Object type from the nested attrs, then wrap it per the
// NestingMode. No dynamic fallback here — nested attrs are allowed to be
// null when absent, so the empty-Tuple/Object workaround that blocks need
// doesn't apply.
func nestedObjectType(obj *tfprotov6.SchemaObject) tftypes.Type {
	inner := make(map[string]tftypes.Type, len(obj.Attributes))
	for _, a := range obj.Attributes {
		inner[a.Name] = attributeType(a)
	}
	objType := tftypes.Object{AttributeTypes: inner}
	switch obj.Nesting {
	case tfprotov6.SchemaObjectNestingModeList:
		return tftypes.List{ElementType: objType}
	case tfprotov6.SchemaObjectNestingModeSet:
		return tftypes.Set{ElementType: objType}
	case tfprotov6.SchemaObjectNestingModeMap:
		return tftypes.Map{ElementType: objType}
	}
	// NestingSingle (and Invalid, defensively) — bare object.
	return objType
}

// hasDynamic reports whether t contains a tftypes.DynamicPseudoType anywhere
// in its structure. Used to decide the outer type for a block whose inner
// object carries dynamic attrs, matching TF core's HasDynamicTypes check.
func hasDynamic(t tftypes.Type) bool {
	if t == nil {
		return false
	}
	if t.Is(tftypes.DynamicPseudoType) {
		return true
	}
	switch tt := t.(type) {
	case tftypes.Object:
		for _, v := range tt.AttributeTypes {
			if hasDynamic(v) {
				return true
			}
		}
	case tftypes.List:
		return hasDynamic(tt.ElementType)
	case tftypes.Set:
		return hasDynamic(tt.ElementType)
	case tftypes.Map:
		return hasDynamic(tt.ElementType)
	case tftypes.Tuple:
		for _, v := range tt.ElementTypes {
			if hasDynamic(v) {
				return true
			}
		}
	}
	return false
}
