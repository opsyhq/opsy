package types

import "encoding/json"

// Diagnostic mirrors a tfprotov6.Diagnostic for JSON serialization.
type Diagnostic struct {
	Severity  string   `json:"severity"` // "error" or "warning"
	Summary   string   `json:"summary"`
	Detail    string   `json:"detail,omitempty"`
	Attribute []string `json:"attribute,omitempty"` // attribute path components
}

// ErrorResponse is returned for transport-level errors (HTTP 4xx/5xx).
type ErrorResponse struct {
	Error             string   `json:"error"`
	Detail            string   `json:"detail,omitempty"`
	AvailableVersions []string `json:"available_versions,omitempty"`
}

// ProviderMetadataResponse is returned from POST /providers/metadata.
type ProviderMetadataResponse struct {
	ServerCapabilities ProviderServerCapabilities `json:"server_capabilities"`
	Diagnostics        []Diagnostic               `json:"diagnostics,omitempty"`
}

// ProviderServerCapabilities mirrors tfprotov6.ServerCapabilities.
type ProviderServerCapabilities struct {
	PlanDestroy               bool `json:"plan_destroy"`
	GetProviderSchemaOptional bool `json:"get_provider_schema_optional"`
	MoveResourceState         bool `json:"move_resource_state"`
}

// SchemaAttribute describes a single attribute in a schema.
type SchemaAttribute struct {
	Type           json.RawMessage `json:"type"`
	Description    string          `json:"description,omitempty"`
	Required       bool            `json:"required,omitempty"`
	Optional       bool            `json:"optional,omitempty"`
	Computed       bool            `json:"computed,omitempty"`
	Sensitive      bool            `json:"sensitive,omitempty"`
	DeprecationMsg string          `json:"deprecation_message,omitempty"`
}

// SchemaBlock describes a nested block in a schema.
type SchemaBlock struct {
	Attributes         map[string]*SchemaAttribute   `json:"attributes,omitempty"`
	BlockTypes         map[string]*SchemaNestedBlock `json:"block_types,omitempty"`
	Description        string                        `json:"description,omitempty"`
	Deprecated         bool                          `json:"deprecated,omitempty"`
	DeprecationMessage string                        `json:"deprecation_message,omitempty"`
}

// SchemaNestedBlock describes a nested block type.
type SchemaNestedBlock struct {
	NestingMode string       `json:"nesting_mode"` // "single", "list", "set", "map", "group"
	Block       *SchemaBlock `json:"block"`
	MinItems    int64        `json:"min_items,omitempty"`
	MaxItems    int64        `json:"max_items,omitempty"`
}

// ResourceSchema describes the schema for a resource or data source.
type ResourceSchema struct {
	Version int64        `json:"version"`
	Block   *SchemaBlock `json:"block"`
}

// ProviderSummaryResponse is returned from POST /providers/summary.
type ProviderSummaryResponse struct {
	ProviderSource     string                     `json:"provider_source"`
	ProviderVersion    string                     `json:"provider_version"`
	ResourceCount      int                        `json:"resource_count"`
	DataSourceCount    int                        `json:"data_source_count"`
	ServerCapabilities ProviderServerCapabilities `json:"server_capabilities"`
	Diagnostics        []Diagnostic               `json:"diagnostics,omitempty"`
}

// ProviderTypeSearchHit is one manifest-backed type search result.
type ProviderTypeSearchHit struct {
	Type  string   `json:"type"`
	Kinds []string `json:"kinds"`
}

// ProviderTypesSearchResponse is returned from POST /providers/types/search.
type ProviderTypesSearchResponse struct {
	Results   []ProviderTypeSearchHit `json:"results"`
	Truncated bool                    `json:"truncated"`
}

// ProviderTypeResolveResponse is returned from POST /providers/types/resolve.
type ProviderTypeResolveResponse struct {
	Type           string   `json:"type"`
	Kinds          []string `json:"kinds"`
	ResourcePath   string   `json:"resource_path,omitempty"`
	DataSourcePath string   `json:"data_source_path,omitempty"`
}

// ProviderTypeSchemaResponse is returned from POST /providers/types/schema.
type ProviderTypeSchemaResponse struct {
	Type   string          `json:"type"`
	Kind   string          `json:"kind"`
	Schema *ResourceSchema `json:"schema"`
}

// ProviderConfigSchemaResponse is returned from POST /providers/config-schema.
type ProviderConfigSchemaResponse struct {
	Schema      *ResourceSchema `json:"schema"`
	Diagnostics []Diagnostic    `json:"diagnostics,omitempty"`
}

// IdentityAttribute mirrors tfprotov6.ResourceIdentitySchemaAttribute. One
// field of a resource's import identity (e.g. aws_s3_bucket: bucket required,
// region/account_id optional).
type IdentityAttribute struct {
	Name string `json:"name"`
	// Type is the tftypes.Type JSON signature serialized by the Terraform
	// library itself. Raw structured JSON, parsed back only with
	// tftypes.ParseJSONType; do not add a local type codec here.
	Type              json.RawMessage `json:"type,omitempty"`
	RequiredForImport bool            `json:"required_for_import,omitempty"`
	OptionalForImport bool            `json:"optional_for_import,omitempty"`
	Description       string          `json:"description,omitempty"`
}

// ResourceIdentitySchema mirrors tfprotov6.ResourceIdentitySchema: the
// structured set of attributes a resource needs to be imported.
type ResourceIdentitySchema struct {
	Version    int64               `json:"version"`
	Attributes []IdentityAttribute `json:"attributes"`
}

// ProviderTypeIdentityResponse is returned from POST
// /providers/types/identity. An absent Identity means the type exists but the
// provider advertises no structured import identity, so the caller falls back
// to a raw Terraform import ID.
type ProviderTypeIdentityResponse struct {
	Type        string                  `json:"type"`
	Identity    *ResourceIdentitySchema `json:"identity,omitempty"`
	Diagnostics []Diagnostic            `json:"diagnostics,omitempty"`
}

// ValidateResponse is returned from validate endpoints.
type ValidateResponse struct {
	Diagnostics []Diagnostic `json:"diagnostics,omitempty"`
}

// ResourceReadResponse is returned from POST /resources/read.
type ResourceReadResponse struct {
	NewState    json.RawMessage `json:"new_state"`
	Private     []byte          `json:"private,omitempty"`
	Diagnostics []Diagnostic    `json:"diagnostics,omitempty"`
}

// ResourcePlanResponse is returned from POST /resources/plan.
type ResourcePlanResponse struct {
	PlannedState    json.RawMessage `json:"planned_state"`
	PlannedPrivate  []byte          `json:"planned_private,omitempty"`
	RequiresReplace [][]string      `json:"requires_replace,omitempty"`
	Diagnostics     []Diagnostic    `json:"diagnostics,omitempty"`
}

// ResourceApplyResponse is returned from POST /resources/apply.
type ResourceApplyResponse struct {
	NewState    json.RawMessage `json:"new_state"`
	Private     []byte          `json:"private,omitempty"`
	Diagnostics []Diagnostic    `json:"diagnostics,omitempty"`
}

// ResourceImportResponse is returned from POST /resources/import.
type ResourceImportResponse struct {
	ImportedResources []ImportedResource `json:"imported_resources"`
	Diagnostics       []Diagnostic       `json:"diagnostics,omitempty"`
}

// ImportedResource holds the result of a single imported resource.
type ImportedResource struct {
	TypeName string          `json:"type_name"`
	State    json.RawMessage `json:"state"`
	Private  []byte          `json:"private,omitempty"`
}

// DataSourceReadResponse is returned from POST /data-sources/read.
type DataSourceReadResponse struct {
	State       json.RawMessage `json:"state"`
	Diagnostics []Diagnostic    `json:"diagnostics,omitempty"`
}
