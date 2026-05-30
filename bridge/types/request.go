package types

import "encoding/json"

// ProviderRef is embedded in every request to identify the provider.
type ProviderRef struct {
	ProviderSource  string          `json:"provider_source"`
	ProviderVersion string          `json:"provider_version"`
	ProviderConfig  json.RawMessage `json:"provider_config"`
}

// ProviderMetadataRequest is the request body for POST /providers/metadata.
type ProviderMetadataRequest struct {
	ProviderRef
}

// ProviderSummaryRequest is the request body for POST /providers/summary.
type ProviderSummaryRequest struct {
	ProviderSource  string `json:"provider_source"`
	ProviderVersion string `json:"provider_version"`
}

// ProviderTypesSearchRequest is the request body for POST /providers/types/search.
type ProviderTypesSearchRequest struct {
	ProviderSource  string `json:"provider_source"`
	ProviderVersion string `json:"provider_version"`
	Query           string `json:"q,omitempty"`
	Kind            string `json:"kind,omitempty"` // "resource", "data", or "both"
	Limit           int    `json:"limit,omitempty"`
	Offset          int    `json:"offset,omitempty"`
}

// ProviderTypeResolveRequest is the request body for POST /providers/types/resolve.
type ProviderTypeResolveRequest struct {
	ProviderSource  string `json:"provider_source"`
	ProviderVersion string `json:"provider_version"`
	Type            string `json:"type"`
}

// ProviderTypeSchemaRequest is the request body for POST /providers/types/schema.
type ProviderTypeSchemaRequest struct {
	ProviderSource  string `json:"provider_source"`
	ProviderVersion string `json:"provider_version"`
	Type            string `json:"type"`
	Kind            string `json:"kind"` // "resource" or "data"
}

// ProviderConfigSchemaRequest is the request body for POST /providers/config-schema.
type ProviderConfigSchemaRequest struct {
	ProviderSource  string `json:"provider_source"`
	ProviderVersion string `json:"provider_version"`
}

// ProviderTypeIdentityRequest is the request body for POST
// /providers/types/identity. Credential-free: a resource's import-identity
// schema is static per provider version and captured at schema-extract time.
type ProviderTypeIdentityRequest struct {
	ProviderSource  string `json:"provider_source"`
	ProviderVersion string `json:"provider_version"`
	Type            string `json:"type"`
}

// ProviderValidateRequest is the request body for POST /providers/validate-config.
type ProviderValidateRequest struct {
	ProviderRef
}

// ResourceValidateRequest is the request body for POST /resources/validate-config.
type ResourceValidateRequest struct {
	ProviderRef
	Type   string          `json:"type"`
	Config json.RawMessage `json:"config"`
}

// ResourceReadRequest is the request body for POST /resources/read.
type ResourceReadRequest struct {
	ProviderRef
	Type         string          `json:"type"`
	CurrentState json.RawMessage `json:"current_state"`
	Private      []byte          `json:"private"`
}

// ResourcePlanRequest is the request body for POST /resources/plan.
type ResourcePlanRequest struct {
	ProviderRef
	Type             string          `json:"type"`
	PriorState       json.RawMessage `json:"prior_state"`
	ProposedNewState json.RawMessage `json:"proposed_new_state"`
	Config           json.RawMessage `json:"config"`
	PriorPrivate     []byte          `json:"prior_private"`
}

// ResourceApplyRequest is the request body for POST /resources/apply.
type ResourceApplyRequest struct {
	ProviderRef
	Type           string          `json:"type"`
	PriorState     json.RawMessage `json:"prior_state"`
	PlannedState   json.RawMessage `json:"planned_state"`
	Config         json.RawMessage `json:"config"`
	PlannedPrivate []byte          `json:"planned_private"`
	// RequiresReplace is the attribute-path list from the plan response.
	// When non-empty, the stored action is "replace" not "update".
	RequiresReplace [][]string `json:"requires_replace,omitempty"`
}

// ResourceImportRequest is the request body for POST /resources/import.
// ProviderID and Identity are mutually exclusive, mirroring Terraform's
// ImportResourceStateRequest: ProviderID is the raw `terraform import` ID;
// Identity carries each structured identity attribute by name (raw user
// strings — the bridge coerces them against the cached identity schema,
// the single authority for each attribute's wire type).
type ResourceImportRequest struct {
	ProviderRef
	Type       string            `json:"type"`
	ProviderID string            `json:"provider_id,omitempty"`
	Identity   map[string]string `json:"identity,omitempty"`
}

// DataSourceReadRequest is the request body for POST /data-sources/read.
type DataSourceReadRequest struct {
	ProviderRef
	Type   string          `json:"type"`
	Config json.RawMessage `json:"config"`
}
