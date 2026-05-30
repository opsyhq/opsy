package schema_test

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	"github.com/hashicorp/terraform-plugin-go/tftypes"
	"github.com/opsydev/opsy/bridge/codec"
	"github.com/opsydev/opsy/bridge/schema"
)

func TestCanonicalSchemaRoundTripPreservesTerraformShape(t *testing.T) {
	original := testSchema()
	canonical, err := schema.SchemaFromTF(original)
	if err != nil {
		t.Fatalf("SchemaFromTF: %v", err)
	}

	if len(canonical.Block.Attributes) != 3 {
		t.Fatalf("attributes should remain an array, got %d", len(canonical.Block.Attributes))
	}
	if len(canonical.Block.BlockTypes) != 2 {
		t.Fatalf("block_types should remain an array, got %d", len(canonical.Block.BlockTypes))
	}
	if canonical.Block.DescriptionKind != "markdown" {
		t.Fatalf("block description_kind = %q, want markdown", canonical.Block.DescriptionKind)
	}

	secret := canonical.Block.Attributes[1]
	if !secret.WriteOnly {
		t.Fatalf("write_only was not preserved")
	}
	if secret.DescriptionKind != "plain" {
		t.Fatalf("attribute description_kind = %q, want plain", secret.DescriptionKind)
	}

	nested := canonical.Block.Attributes[2].NestedType
	if nested == nil {
		t.Fatalf("nested_type missing")
	}
	if nested.Nesting != "list" {
		t.Fatalf("nested_type.nesting = %q, want list", nested.Nesting)
	}
	if len(nested.Attributes) != 1 || nested.Attributes[0].Name != "enabled" {
		t.Fatalf("nested_type attributes not preserved: %#v", nested.Attributes)
	}

	if canonical.Block.BlockTypes[0].Nesting != "list" {
		t.Fatalf("first block nesting = %q, want list", canonical.Block.BlockTypes[0].Nesting)
	}
	if canonical.Block.BlockTypes[1].Nesting != "group" {
		t.Fatalf("second block nesting = %q, want group", canonical.Block.BlockTypes[1].Nesting)
	}

	roundTripped, err := canonical.ToTF()
	if err != nil {
		t.Fatalf("ToTF: %v", err)
	}
	if roundTripped.Block.Attributes[1].WriteOnly != original.Block.Attributes[1].WriteOnly {
		t.Fatalf("round-trip write_only = %v, want %v", roundTripped.Block.Attributes[1].WriteOnly, original.Block.Attributes[1].WriteOnly)
	}
	if roundTripped.Block.DescriptionKind != original.Block.DescriptionKind {
		t.Fatalf("round-trip block description kind = %v, want %v", roundTripped.Block.DescriptionKind, original.Block.DescriptionKind)
	}
	if roundTripped.Block.Attributes[2].NestedType == nil {
		t.Fatalf("round-trip nested_type missing")
	}
}

func TestTypeSignatureUsesTftypesJSONSerialization(t *testing.T) {
	canonical, err := schema.SchemaFromTF(testSchema())
	if err != nil {
		t.Fatalf("SchemaFromTF: %v", err)
	}
	raw, err := json.Marshal(canonical)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	var decoded struct {
		Block struct {
			Attributes []struct {
				Name string `json:"name"`
				Type any    `json:"type"`
			} `json:"attributes"`
		} `json:"block"`
	}
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	typesByName := map[string]any{}
	for _, attr := range decoded.Block.Attributes {
		typesByName[attr.Name] = attr.Type
	}
	if got := typesByName["name"]; got != "string" {
		t.Fatalf("primitive type JSON = %#v, want string", got)
	}
	mapType, ok := typesByName["tags"].([]any)
	if !ok {
		t.Fatalf("complex type should be raw JSON array, got %T %#v", typesByName["tags"], typesByName["tags"])
	}
	if !reflect.DeepEqual(mapType, []any{"map", "string"}) {
		t.Fatalf("complex type JSON = %#v, want [map string]", mapType)
	}

	roundTripped, err := canonical.ToTF()
	if err != nil {
		t.Fatalf("ToTF: %v", err)
	}
	if !roundTripped.Block.Attributes[0].Type.Equal(tftypes.String) {
		t.Fatalf("primitive type did not parse with tftypes.ParseJSONType")
	}
	if !roundTripped.Block.Attributes[1].Type.Equal(tftypes.Map{ElementType: tftypes.String}) {
		t.Fatalf("complex type did not parse with tftypes.ParseJSONType")
	}
}

func TestCanonicalSchemaTypeParity(t *testing.T) {
	original := testSchema()
	canonical, err := schema.SchemaFromTF(original)
	if err != nil {
		t.Fatalf("SchemaFromTF: %v", err)
	}
	got, err := schema.ToSchemaType(canonical)
	if err != nil {
		t.Fatalf("ToSchemaType: %v", err)
	}
	want := codec.SchemaToType(original)
	assertSchemaTypeEqual(t, got, want)
}

func assertSchemaTypeEqual(t *testing.T, got, want codec.SchemaType) {
	t.Helper()
	if !got.Type.Equal(want.Type) {
		t.Fatalf("type = %v, want %v", got.Type, want.Type)
	}
	if len(got.Blocks) != len(want.Blocks) {
		t.Fatalf("block count = %d, want %d", len(got.Blocks), len(want.Blocks))
	}
	for name, wantBlock := range want.Blocks {
		gotBlock, ok := got.Blocks[name]
		if !ok {
			t.Fatalf("missing block %q", name)
		}
		if gotBlock.Nesting != wantBlock.Nesting {
			t.Fatalf("block %q nesting = %v, want %v", name, gotBlock.Nesting, wantBlock.Nesting)
		}
		assertSchemaTypeEqual(t, gotBlock.Inner, wantBlock.Inner)
	}
}

func testSchema() *tfprotov6.Schema {
	return &tfprotov6.Schema{
		Version: 7,
		Block: &tfprotov6.SchemaBlock{
			Version:         1,
			Description:     "root",
			DescriptionKind: tfprotov6.StringKindMarkdown,
			Attributes: []*tfprotov6.SchemaAttribute{
				{
					Name:        "name",
					Type:        tftypes.String,
					Required:    true,
					Description: "name",
				},
				{
					Name:        "tags",
					Type:        tftypes.Map{ElementType: tftypes.String},
					Optional:    true,
					WriteOnly:   true,
					Description: "tags",
				},
				{
					Name:     "settings",
					Optional: true,
					NestedType: &tfprotov6.SchemaObject{
						Nesting: tfprotov6.SchemaObjectNestingModeList,
						Attributes: []*tfprotov6.SchemaAttribute{
							{
								Name:            "enabled",
								Type:            tftypes.Bool,
								Optional:        true,
								DescriptionKind: tfprotov6.StringKindMarkdown,
							},
						},
					},
				},
			},
			BlockTypes: []*tfprotov6.SchemaNestedBlock{
				{
					TypeName: "rule",
					Nesting:  tfprotov6.SchemaNestedBlockNestingModeList,
					MinItems: 1,
					MaxItems: 3,
					Block: &tfprotov6.SchemaBlock{
						Attributes: []*tfprotov6.SchemaAttribute{
							{Name: "port", Type: tftypes.Number, Optional: true},
						},
					},
				},
				{
					TypeName: "timeouts",
					Nesting:  tfprotov6.SchemaNestedBlockNestingModeGroup,
					Block: &tfprotov6.SchemaBlock{
						Attributes: []*tfprotov6.SchemaAttribute{
							{Name: "create", Type: tftypes.String, Optional: true},
						},
					},
				},
			},
		},
	}
}
