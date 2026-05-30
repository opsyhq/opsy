package schema

import (
	"encoding/json"

	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	"github.com/opsydev/opsy/bridge/codec"
	"github.com/opsydev/opsy/bridge/types"
)

func ToResourceSchema(schema *Schema) (*types.ResourceSchema, error) {
	tfSchema, err := schema.ToTF()
	if err != nil {
		return nil, err
	}
	return tfToResourceSchema(tfSchema), nil
}

func ToSchemaType(schema *Schema) (codec.SchemaType, error) {
	tfSchema, err := schema.ToTF()
	if err != nil {
		return codec.SchemaType{}, err
	}
	return codec.SchemaToType(tfSchema), nil
}

func DiagnosticsToWire(diags []Diagnostic) []types.Diagnostic {
	if len(diags) == 0 {
		return nil
	}
	out := make([]types.Diagnostic, 0, len(diags))
	for _, d := range diags {
		out = append(out, types.Diagnostic{
			Severity:  d.Severity,
			Summary:   d.Summary,
			Detail:    d.Detail,
			Attribute: append([]string(nil), d.Attribute...),
		})
	}
	return out
}

func tfToResourceSchema(s *tfprotov6.Schema) *types.ResourceSchema {
	if s == nil {
		return nil
	}
	return &types.ResourceSchema{
		Version: s.Version,
		Block:   tfToWireBlock(s.Block),
	}
}

func tfToWireBlock(b *tfprotov6.SchemaBlock) *types.SchemaBlock {
	if b == nil {
		return nil
	}
	block := &types.SchemaBlock{
		Description:        b.Description,
		Deprecated:         b.Deprecated,
		DeprecationMessage: b.DeprecationMessage,
		Attributes:         make(map[string]*types.SchemaAttribute),
		BlockTypes:         make(map[string]*types.SchemaNestedBlock),
	}
	for _, attr := range b.Attributes {
		typeJSON, _ := json.Marshal(attr.Type)
		block.Attributes[attr.Name] = &types.SchemaAttribute{
			Type:           typeJSON,
			Description:    attr.Description,
			Required:       attr.Required,
			Optional:       attr.Optional,
			Computed:       attr.Computed,
			Sensitive:      attr.Sensitive,
			DeprecationMsg: attr.DeprecationMessage,
		}
	}
	for _, nb := range b.BlockTypes {
		block.BlockTypes[nb.TypeName] = &types.SchemaNestedBlock{
			NestingMode: blockNesting(nb.Nesting),
			Block:       tfToWireBlock(nb.Block),
			MinItems:    nb.MinItems,
			MaxItems:    nb.MaxItems,
		}
	}
	return block
}
