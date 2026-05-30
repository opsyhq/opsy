package handler

import (
	"testing"

	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	"github.com/opsydev/opsy/bridge/schema"
)

func TestSelectedSchemaProjectionCarriesDeprecation(t *testing.T) {
	canonical, err := schema.SchemaFromTF(&tfprotov6.Schema{
		Block: &tfprotov6.SchemaBlock{
			Description:        "legacy block",
			Deprecated:         true,
			DeprecationMessage: "Use the replacement block instead.",
			BlockTypes: []*tfprotov6.SchemaNestedBlock{
				{
					TypeName: "child",
					Nesting:  tfprotov6.SchemaNestedBlockNestingModeSingle,
					Block: &tfprotov6.SchemaBlock{
						Deprecated:         true,
						DeprecationMessage: "Child is deprecated.",
					},
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("SchemaFromTF: %v", err)
	}
	projected, err := schema.ToResourceSchema(canonical)
	if err != nil {
		t.Fatalf("ToResourceSchema: %v", err)
	}
	block := projected.Block

	if block == nil {
		t.Fatal("expected converted block")
	}
	if !block.Deprecated {
		t.Fatal("expected top-level block to be deprecated")
	}
	if block.DeprecationMessage != "Use the replacement block instead." {
		t.Fatalf("unexpected deprecation message: %q", block.DeprecationMessage)
	}
	child := block.BlockTypes["child"].Block
	if child == nil || !child.Deprecated {
		t.Fatal("expected nested block deprecation to be preserved")
	}
	if child.DeprecationMessage != "Child is deprecated." {
		t.Fatalf("unexpected child deprecation message: %q", child.DeprecationMessage)
	}
}
