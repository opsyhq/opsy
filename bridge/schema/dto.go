package schema

import (
	"encoding/json"
	"fmt"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	"github.com/hashicorp/terraform-plugin-go/tftypes"

	"github.com/opsydev/opsy/bridge/types"
)

const (
	KindProvider     = "provider"
	KindProviderMeta = "provider_meta"
	KindResource     = "resource"
	KindDataSource   = "data"
)

type Manifest struct {
	ProviderSource     string              `json:"provider_source"`
	ProviderVersion    string              `json:"provider_version"`
	ProviderPath       string              `json:"provider_path"`
	ProviderMetaPath   string              `json:"provider_meta_path,omitempty"`
	ResourceCount      int                 `json:"resource_count"`
	DataSourceCount    int                 `json:"data_source_count"`
	Resources          []ManifestType      `json:"resources"`
	DataSources        []ManifestType      `json:"data_sources"`
	ServerCapabilities *ServerCapabilities `json:"server_capabilities,omitempty"`
	Diagnostics        []Diagnostic        `json:"diagnostics,omitempty"`
}

type ManifestType struct {
	Type       string `json:"type"`
	Path       string `json:"path"`
	SearchText string `json:"search_text"`
}

type ServerCapabilities struct {
	PlanDestroy               bool `json:"plan_destroy"`
	GetProviderSchemaOptional bool `json:"get_provider_schema_optional"`
	MoveResourceState         bool `json:"move_resource_state"`
}

type Diagnostic struct {
	Severity  string   `json:"severity"`
	Summary   string   `json:"summary"`
	Detail    string   `json:"detail,omitempty"`
	Attribute []string `json:"attribute,omitempty"`
}

type Shard struct {
	ProviderSource  string  `json:"provider_source"`
	ProviderVersion string  `json:"provider_version"`
	Kind            string  `json:"kind"`
	Type            string  `json:"type,omitempty"`
	Schema          *Schema `json:"schema"`
	// Identity is the resource's import-identity schema, captured
	// credential-free at extract time. Only set on resource shards whose
	// provider advertises a GetResourceIdentitySchemas entry; nil means the
	// caller must fall back to a raw Terraform import ID. It is the wire
	// shape directly: no ToTF round-trip is needed because identity is
	// served verbatim, never re-encoded for the provider plugin.
	Identity *types.ResourceIdentitySchema `json:"identity,omitempty"`
}

type Schema struct {
	Version int64  `json:"version"`
	Block   *Block `json:"block,omitempty"`
}

type Block struct {
	Version            int64          `json:"version,omitempty"`
	Attributes         []*Attribute   `json:"attributes"`
	BlockTypes         []*NestedBlock `json:"block_types"`
	Description        string         `json:"description,omitempty"`
	DescriptionKind    string         `json:"description_kind"`
	Deprecated         bool           `json:"deprecated,omitempty"`
	DeprecationMessage string         `json:"deprecation_message,omitempty"`
}

type Attribute struct {
	Name string `json:"name"`
	// Type is the tftypes.Type JSON signature serialized by the Terraform
	// library itself. This is raw structured JSON under "type" and is parsed
	// back only with tftypes.ParseJSONType; do not add a local type codec here.
	Type               json.RawMessage `json:"type,omitempty"`
	NestedType         *Object         `json:"nested_type,omitempty"`
	Description        string          `json:"description,omitempty"`
	DescriptionKind    string          `json:"description_kind"`
	Required           bool            `json:"required,omitempty"`
	Optional           bool            `json:"optional,omitempty"`
	Computed           bool            `json:"computed,omitempty"`
	Sensitive          bool            `json:"sensitive,omitempty"`
	Deprecated         bool            `json:"deprecated,omitempty"`
	WriteOnly          bool            `json:"write_only,omitempty"`
	DeprecationMessage string          `json:"deprecation_message,omitempty"`
}

type Object struct {
	Attributes []*Attribute `json:"attributes"`
	Nesting    string       `json:"nesting"`
}

type NestedBlock struct {
	TypeName string `json:"type_name"`
	Block    *Block `json:"block"`
	Nesting  string `json:"nesting"`
	MinItems int64  `json:"min_items,omitempty"`
	MaxItems int64  `json:"max_items,omitempty"`
}

func CacheDir(root, providerSource, providerVersion string) (string, error) {
	if strings.TrimSpace(root) == "" {
		return "", fmt.Errorf("schema cache dir is empty")
	}
	segments := append(strings.Split(providerSource, "/"), providerVersion)
	for _, segment := range segments {
		if segment == "" || segment == "." || segment == ".." || strings.Contains(segment, string(filepath.Separator)) {
			return "", fmt.Errorf("invalid provider cache path segment %q", segment)
		}
	}
	parts := append([]string{root}, segments...)
	return filepath.Join(parts...), nil
}

func ManifestPath(root, providerSource, providerVersion string) (string, error) {
	dir, err := CacheDir(root, providerSource, providerVersion)
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "manifest.json"), nil
}

func ProviderPath() string {
	return "provider.json"
}

func ProviderMetaPath() string {
	return "provider_meta.json"
}

func TypePath(kind, typeName string) (string, error) {
	if typeName == "" || strings.Contains(typeName, "/") || strings.Contains(typeName, string(filepath.Separator)) || typeName == "." || typeName == ".." {
		return "", fmt.Errorf("invalid schema type name %q", typeName)
	}
	switch kind {
	case KindResource:
		return path.Join("resources", typeName+".json"), nil
	case KindDataSource:
		return path.Join("data-sources", typeName+".json"), nil
	default:
		return "", fmt.Errorf("unsupported schema kind %q", kind)
	}
}

func SearchText(typeName string, schema *tfprotov6.Schema) string {
	parts := []string{
		typeName,
		strings.ReplaceAll(typeName, "_", " "),
	}
	if _, suffix, ok := strings.Cut(typeName, "_"); ok && suffix != "" {
		parts = append(parts, strings.ReplaceAll(suffix, "_", " "))
	}
	if schema != nil && schema.Block != nil {
		parts = append(parts, schema.Block.Description, schema.Block.DeprecationMessage)
	}
	searchText := make([]string, 0, len(parts))
	for _, part := range parts {
		if fields := strings.Fields(part); len(fields) > 0 {
			searchText = append(searchText, strings.Join(fields, " "))
		}
	}
	return strings.Join(searchText, " ")
}

func NewManifest(providerSource, providerVersion string, schema *tfprotov6.GetProviderSchemaResponse) *Manifest {
	resources := make([]ManifestType, 0, len(schema.ResourceSchemas))
	for typeName, resourceSchema := range schema.ResourceSchemas {
		p, _ := TypePath(KindResource, typeName)
		resources = append(resources, ManifestType{Type: typeName, Path: p, SearchText: SearchText(typeName, resourceSchema)})
	}
	dataSources := make([]ManifestType, 0, len(schema.DataSourceSchemas))
	for typeName, dataSourceSchema := range schema.DataSourceSchemas {
		p, _ := TypePath(KindDataSource, typeName)
		dataSources = append(dataSources, ManifestType{Type: typeName, Path: p, SearchText: SearchText(typeName, dataSourceSchema)})
	}
	sort.Slice(resources, func(i, j int) bool { return resources[i].Type < resources[j].Type })
	sort.Slice(dataSources, func(i, j int) bool { return dataSources[i].Type < dataSources[j].Type })

	manifest := &Manifest{
		ProviderSource:  providerSource,
		ProviderVersion: providerVersion,
		ProviderPath:    ProviderPath(),
		ResourceCount:   len(resources),
		DataSourceCount: len(dataSources),
		Resources:       resources,
		DataSources:     dataSources,
		Diagnostics:     DiagnosticsFromTF(schema.Diagnostics),
	}
	if schema.ProviderMeta != nil {
		manifest.ProviderMetaPath = ProviderMetaPath()
	}
	if schema.ServerCapabilities != nil {
		manifest.ServerCapabilities = &ServerCapabilities{
			PlanDestroy:               schema.ServerCapabilities.PlanDestroy,
			GetProviderSchemaOptional: schema.ServerCapabilities.GetProviderSchemaOptional,
			MoveResourceState:         schema.ServerCapabilities.MoveResourceState,
		}
	}
	return manifest
}

// IdentitySchemasFromTF converts the GetResourceIdentitySchemas RPC payload
// into the wire shape persisted per-type inside each resource's shard. Each
// attribute's tftypes.Type is serialized to its library-owned JSON signature
// exactly like AttributeFromTF; it is parsed back only with
// tftypes.ParseJSONType.
func IdentitySchemasFromTF(schemas map[string]*tfprotov6.ResourceIdentitySchema) (map[string]types.ResourceIdentitySchema, error) {
	if len(schemas) == 0 {
		return nil, nil
	}
	out := make(map[string]types.ResourceIdentitySchema, len(schemas))
	for typeName, schema := range schemas {
		if schema == nil {
			continue
		}
		attrs := make([]types.IdentityAttribute, 0, len(schema.IdentityAttributes))
		for _, attr := range schema.IdentityAttributes {
			if attr == nil {
				continue
			}
			var typeJSON json.RawMessage
			if attr.Type != nil {
				raw, err := json.Marshal(attr.Type)
				if err != nil {
					return nil, fmt.Errorf("serialize Terraform type signature for identity attribute %q.%q: %w", typeName, attr.Name, err)
				}
				typeJSON = append(json.RawMessage(nil), raw...)
			}
			attrs = append(attrs, types.IdentityAttribute{
				Name:              attr.Name,
				Type:              typeJSON,
				RequiredForImport: attr.RequiredForImport,
				OptionalForImport: attr.OptionalForImport,
				Description:       attr.Description,
			})
		}
		out[typeName] = types.ResourceIdentitySchema{Version: schema.Version, Attributes: attrs}
	}
	return out, nil
}

func ShardFromTF(providerSource, providerVersion, kind, typeName string, schema *tfprotov6.Schema) (*Shard, error) {
	canonical, err := SchemaFromTF(schema)
	if err != nil {
		return nil, err
	}
	return &Shard{
		ProviderSource:  providerSource,
		ProviderVersion: providerVersion,
		Kind:            kind,
		Type:            typeName,
		Schema:          canonical,
	}, nil
}

func SchemaFromTF(schema *tfprotov6.Schema) (*Schema, error) {
	if schema == nil {
		return nil, nil
	}
	block, err := BlockFromTF(schema.Block)
	if err != nil {
		return nil, err
	}
	return &Schema{Version: schema.Version, Block: block}, nil
}

func BlockFromTF(block *tfprotov6.SchemaBlock) (*Block, error) {
	if block == nil {
		return nil, nil
	}
	out := &Block{
		Version:            block.Version,
		Attributes:         make([]*Attribute, 0, len(block.Attributes)),
		BlockTypes:         make([]*NestedBlock, 0, len(block.BlockTypes)),
		Description:        block.Description,
		DescriptionKind:    stringKind(block.DescriptionKind),
		Deprecated:         block.Deprecated,
		DeprecationMessage: block.DeprecationMessage,
	}
	for _, attr := range block.Attributes {
		converted, err := AttributeFromTF(attr)
		if err != nil {
			return nil, err
		}
		out.Attributes = append(out.Attributes, converted)
	}
	for _, nested := range block.BlockTypes {
		converted, err := NestedBlockFromTF(nested)
		if err != nil {
			return nil, err
		}
		out.BlockTypes = append(out.BlockTypes, converted)
	}
	return out, nil
}

func AttributeFromTF(attr *tfprotov6.SchemaAttribute) (*Attribute, error) {
	if attr == nil {
		return nil, nil
	}
	var typeJSON json.RawMessage
	if attr.Type != nil {
		// Serialization boundary: tftypes.Type owns the Terraform JSON type
		// signature. The surrounding Schema DTO is custom because tfprotov6.Schema
		// has no stable array-shaped JSON persistence form.
		raw, err := json.Marshal(attr.Type)
		if err != nil {
			return nil, fmt.Errorf("serialize Terraform type signature for attribute %q: %w", attr.Name, err)
		}
		typeJSON = append(json.RawMessage(nil), raw...)
	}
	nested, err := ObjectFromTF(attr.NestedType)
	if err != nil {
		return nil, err
	}
	return &Attribute{
		Name:               attr.Name,
		Type:               typeJSON,
		NestedType:         nested,
		Description:        attr.Description,
		DescriptionKind:    stringKind(attr.DescriptionKind),
		Required:           attr.Required,
		Optional:           attr.Optional,
		Computed:           attr.Computed,
		Sensitive:          attr.Sensitive,
		Deprecated:         attr.Deprecated,
		WriteOnly:          attr.WriteOnly,
		DeprecationMessage: attr.DeprecationMessage,
	}, nil
}

func ObjectFromTF(obj *tfprotov6.SchemaObject) (*Object, error) {
	if obj == nil {
		return nil, nil
	}
	out := &Object{
		Attributes: make([]*Attribute, 0, len(obj.Attributes)),
		Nesting:    objectNesting(obj.Nesting),
	}
	for _, attr := range obj.Attributes {
		converted, err := AttributeFromTF(attr)
		if err != nil {
			return nil, err
		}
		out.Attributes = append(out.Attributes, converted)
	}
	return out, nil
}

func NestedBlockFromTF(block *tfprotov6.SchemaNestedBlock) (*NestedBlock, error) {
	if block == nil {
		return nil, nil
	}
	inner, err := BlockFromTF(block.Block)
	if err != nil {
		return nil, err
	}
	return &NestedBlock{
		TypeName: block.TypeName,
		Block:    inner,
		Nesting:  blockNesting(block.Nesting),
		MinItems: block.MinItems,
		MaxItems: block.MaxItems,
	}, nil
}

func (s *Schema) ToTF() (*tfprotov6.Schema, error) {
	if s == nil {
		return nil, nil
	}
	block, err := s.Block.ToTF()
	if err != nil {
		return nil, err
	}
	return &tfprotov6.Schema{Version: s.Version, Block: block}, nil
}

func (b *Block) ToTF() (*tfprotov6.SchemaBlock, error) {
	if b == nil {
		return nil, nil
	}
	out := &tfprotov6.SchemaBlock{
		Version:            b.Version,
		Attributes:         make([]*tfprotov6.SchemaAttribute, 0, len(b.Attributes)),
		BlockTypes:         make([]*tfprotov6.SchemaNestedBlock, 0, len(b.BlockTypes)),
		Description:        b.Description,
		DescriptionKind:    parseStringKind(b.DescriptionKind),
		Deprecated:         b.Deprecated,
		DeprecationMessage: b.DeprecationMessage,
	}
	for _, attr := range b.Attributes {
		converted, err := attr.ToTF()
		if err != nil {
			return nil, err
		}
		out.Attributes = append(out.Attributes, converted)
	}
	for _, nested := range b.BlockTypes {
		converted, err := nested.ToTF()
		if err != nil {
			return nil, err
		}
		out.BlockTypes = append(out.BlockTypes, converted)
	}
	return out, nil
}

func (a *Attribute) ToTF() (*tfprotov6.SchemaAttribute, error) {
	if a == nil {
		return nil, nil
	}
	var attrType tftypes.Type
	if len(a.Type) > 0 {
		// Deserialization boundary for the library-owned JSON type signature.
		parsed, err := tftypes.ParseJSONType(a.Type)
		if err != nil {
			return nil, fmt.Errorf("deserialize Terraform type signature for attribute %q: %w", a.Name, err)
		}
		attrType = parsed
	}
	nested, err := a.NestedType.ToTF()
	if err != nil {
		return nil, err
	}
	return &tfprotov6.SchemaAttribute{
		Name:               a.Name,
		Type:               attrType,
		NestedType:         nested,
		Description:        a.Description,
		DescriptionKind:    parseStringKind(a.DescriptionKind),
		Required:           a.Required,
		Optional:           a.Optional,
		Computed:           a.Computed,
		Sensitive:          a.Sensitive,
		Deprecated:         a.Deprecated,
		WriteOnly:          a.WriteOnly,
		DeprecationMessage: a.DeprecationMessage,
	}, nil
}

func (o *Object) ToTF() (*tfprotov6.SchemaObject, error) {
	if o == nil {
		return nil, nil
	}
	out := &tfprotov6.SchemaObject{
		Attributes: make([]*tfprotov6.SchemaAttribute, 0, len(o.Attributes)),
		Nesting:    parseObjectNesting(o.Nesting),
	}
	for _, attr := range o.Attributes {
		converted, err := attr.ToTF()
		if err != nil {
			return nil, err
		}
		out.Attributes = append(out.Attributes, converted)
	}
	return out, nil
}

func (b *NestedBlock) ToTF() (*tfprotov6.SchemaNestedBlock, error) {
	if b == nil {
		return nil, nil
	}
	block, err := b.Block.ToTF()
	if err != nil {
		return nil, err
	}
	return &tfprotov6.SchemaNestedBlock{
		TypeName: b.TypeName,
		Block:    block,
		Nesting:  parseBlockNesting(b.Nesting),
		MinItems: b.MinItems,
		MaxItems: b.MaxItems,
	}, nil
}

func DiagnosticsFromTF(diags []*tfprotov6.Diagnostic) []Diagnostic {
	if len(diags) == 0 {
		return nil
	}
	out := make([]Diagnostic, 0, len(diags))
	for _, d := range diags {
		if d == nil {
			continue
		}
		severity := "unknown"
		switch d.Severity {
		case tfprotov6.DiagnosticSeverityError:
			severity = "error"
		case tfprotov6.DiagnosticSeverityWarning:
			severity = "warning"
		}
		var attr []string
		if d.Attribute != nil {
			for _, step := range d.Attribute.Steps() {
				attr = append(attr, fmt.Sprint(step))
			}
		}
		out = append(out, Diagnostic{
			Severity:  severity,
			Summary:   d.Summary,
			Detail:    d.Detail,
			Attribute: attr,
		})
	}
	return out
}

func stringKind(kind tfprotov6.StringKind) string {
	switch kind {
	case tfprotov6.StringKindMarkdown:
		return "markdown"
	default:
		return "plain"
	}
}

func parseStringKind(kind string) tfprotov6.StringKind {
	switch strings.ToLower(kind) {
	case "markdown":
		return tfprotov6.StringKindMarkdown
	default:
		return tfprotov6.StringKindPlain
	}
}

func blockNesting(mode tfprotov6.SchemaNestedBlockNestingMode) string {
	switch mode {
	case tfprotov6.SchemaNestedBlockNestingModeSingle:
		return "single"
	case tfprotov6.SchemaNestedBlockNestingModeList:
		return "list"
	case tfprotov6.SchemaNestedBlockNestingModeSet:
		return "set"
	case tfprotov6.SchemaNestedBlockNestingModeMap:
		return "map"
	case tfprotov6.SchemaNestedBlockNestingModeGroup:
		return "group"
	default:
		return "invalid"
	}
}

func parseBlockNesting(mode string) tfprotov6.SchemaNestedBlockNestingMode {
	switch strings.ToLower(mode) {
	case "single":
		return tfprotov6.SchemaNestedBlockNestingModeSingle
	case "list":
		return tfprotov6.SchemaNestedBlockNestingModeList
	case "set":
		return tfprotov6.SchemaNestedBlockNestingModeSet
	case "map":
		return tfprotov6.SchemaNestedBlockNestingModeMap
	case "group":
		return tfprotov6.SchemaNestedBlockNestingModeGroup
	default:
		return tfprotov6.SchemaNestedBlockNestingModeInvalid
	}
}

func objectNesting(mode tfprotov6.SchemaObjectNestingMode) string {
	switch mode {
	case tfprotov6.SchemaObjectNestingModeSingle:
		return "single"
	case tfprotov6.SchemaObjectNestingModeList:
		return "list"
	case tfprotov6.SchemaObjectNestingModeSet:
		return "set"
	case tfprotov6.SchemaObjectNestingModeMap:
		return "map"
	default:
		return "invalid"
	}
}

func parseObjectNesting(mode string) tfprotov6.SchemaObjectNestingMode {
	switch strings.ToLower(mode) {
	case "single":
		return tfprotov6.SchemaObjectNestingModeSingle
	case "list":
		return tfprotov6.SchemaObjectNestingModeList
	case "set":
		return tfprotov6.SchemaObjectNestingModeSet
	case "map":
		return tfprotov6.SchemaObjectNestingModeMap
	default:
		return tfprotov6.SchemaObjectNestingModeInvalid
	}
}
