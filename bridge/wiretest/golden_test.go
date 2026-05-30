// Package wiretest contains golden-roundtrip tests for the bridge wire types.
//
// Run with UPDATE_GOLDEN=1 to seed (or refresh) the golden JSON files:
//
//	UPDATE_GOLDEN=1 go test ./wiretest/
//
// Without UPDATE_GOLDEN the test asserts that the golden files already exist
// and carry the same JSON payload.
package wiretest

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/opsydev/opsy/bridge/types"
)

// goldenDir is relative to the wiretest package directory (bridge/wiretest/).
// Go test working directory is the package directory containing the test file.
const goldenDir = "../../packages/bridge-client/test/golden"

// marshalGolden marshals v to indented JSON and either writes the golden file
// (when UPDATE_GOLDEN=1) or asserts the file content matches semantically.
func marshalGolden(t *testing.T, name string, v any) {
	t.Helper()

	data, err := json.MarshalIndent(v, "", "\t")
	if err != nil {
		t.Fatalf("marshal %s: %v", name, err)
	}
	// Append trailing newline for VCS cleanliness.
	data = append(data, '\n')

	path := filepath.Join(goldenDir, name+".json")

	if os.Getenv("UPDATE_GOLDEN") == "1" {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatalf("mkdir %s: %v", path, err)
		}
		if err := os.WriteFile(path, data, 0o644); err != nil {
			t.Fatalf("write %s: %v", path, err)
		}
		t.Logf("wrote golden: %s", path)
		return
	}

	existing, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v\n  (run UPDATE_GOLDEN=1 go test ./wiretest/ to seed)", path, err)
	}
	if string(existing) == string(data) {
		return
	}
	var existingJSON any
	var gotJSON any
	if err := json.Unmarshal(existing, &existingJSON); err != nil {
		t.Fatalf("decode existing golden %s: %v", name, err)
	}
	if err := json.Unmarshal(data, &gotJSON); err != nil {
		t.Fatalf("decode generated golden %s: %v", name, err)
	}
	if !reflect.DeepEqual(existingJSON, gotJSON) {
		t.Errorf("golden mismatch for %s\n  got:  %s\n  want: %s", name, data, existing)
	}
}

// nonZeroRawMessage is a reusable json.RawMessage for fixtures.
var nonZeroRawMessage = json.RawMessage(`{"key":"value"}`)

func TestGoldenProviderRef(t *testing.T) {
	marshalGolden(t, "ProviderRef", types.ProviderRef{
		ProviderSource:  "hashicorp/aws",
		ProviderVersion: "5.0.0",
		ProviderConfig:  nonZeroRawMessage,
	})
}

func TestGoldenProviderMetadataRequest(t *testing.T) {
	marshalGolden(t, "ProviderMetadataRequest", types.ProviderMetadataRequest{
		ProviderRef: types.ProviderRef{
			ProviderSource:  "hashicorp/aws",
			ProviderVersion: "5.0.0",
			ProviderConfig:  nonZeroRawMessage,
		},
	})
}

func TestGoldenProviderSummaryRequest(t *testing.T) {
	marshalGolden(t, "ProviderSummaryRequest", types.ProviderSummaryRequest{
		ProviderSource:  "hashicorp/aws",
		ProviderVersion: "5.0.0",
	})
}

func TestGoldenProviderTypesSearchRequest(t *testing.T) {
	marshalGolden(t, "ProviderTypesSearchRequest", types.ProviderTypesSearchRequest{
		ProviderSource:  "hashicorp/aws",
		ProviderVersion: "5.0.0",
		Query:           "bucket",
		Kind:            "resource",
		Limit:           25,
		Offset:          10,
	})
}

func TestGoldenProviderTypeResolveRequest(t *testing.T) {
	marshalGolden(t, "ProviderTypeResolveRequest", types.ProviderTypeResolveRequest{
		ProviderSource:  "hashicorp/aws",
		ProviderVersion: "5.0.0",
		Type:            "aws_s3_bucket",
	})
}

func TestGoldenProviderTypeSchemaRequest(t *testing.T) {
	marshalGolden(t, "ProviderTypeSchemaRequest", types.ProviderTypeSchemaRequest{
		ProviderSource:  "hashicorp/aws",
		ProviderVersion: "5.0.0",
		Type:            "aws_s3_bucket",
		Kind:            "resource",
	})
}

func TestGoldenProviderConfigSchemaRequest(t *testing.T) {
	marshalGolden(t, "ProviderConfigSchemaRequest", types.ProviderConfigSchemaRequest{
		ProviderSource:  "hashicorp/aws",
		ProviderVersion: "5.0.0",
	})
}

func TestGoldenProviderValidateRequest(t *testing.T) {
	marshalGolden(t, "ProviderValidateRequest", types.ProviderValidateRequest{
		ProviderRef: types.ProviderRef{
			ProviderSource:  "hashicorp/aws",
			ProviderVersion: "5.0.0",
			ProviderConfig:  nonZeroRawMessage,
		},
	})
}

func TestGoldenResourceValidateRequest(t *testing.T) {
	marshalGolden(t, "ResourceValidateRequest", types.ResourceValidateRequest{
		ProviderRef: types.ProviderRef{
			ProviderSource:  "hashicorp/aws",
			ProviderVersion: "5.0.0",
			ProviderConfig:  nonZeroRawMessage,
		},
		Type:   "aws_s3_bucket",
		Config: nonZeroRawMessage,
	})
}

func TestGoldenResourceReadRequest(t *testing.T) {
	marshalGolden(t, "ResourceReadRequest", types.ResourceReadRequest{
		ProviderRef: types.ProviderRef{
			ProviderSource:  "hashicorp/aws",
			ProviderVersion: "5.0.0",
			ProviderConfig:  nonZeroRawMessage,
		},
		Type:         "aws_s3_bucket",
		CurrentState: nonZeroRawMessage,
		Private:      []byte("cHJpdmF0ZQ=="),
	})
}

func TestGoldenResourcePlanRequest(t *testing.T) {
	marshalGolden(t, "ResourcePlanRequest", types.ResourcePlanRequest{
		ProviderRef: types.ProviderRef{
			ProviderSource:  "hashicorp/aws",
			ProviderVersion: "5.0.0",
			ProviderConfig:  nonZeroRawMessage,
		},
		Type:             "aws_s3_bucket",
		PriorState:       nonZeroRawMessage,
		ProposedNewState: nonZeroRawMessage,
		Config:           nonZeroRawMessage,
		PriorPrivate:     []byte("cHJpdmF0ZQ=="),
	})
}

func TestGoldenResourceApplyRequest(t *testing.T) {
	marshalGolden(t, "ResourceApplyRequest", types.ResourceApplyRequest{
		ProviderRef: types.ProviderRef{
			ProviderSource:  "hashicorp/aws",
			ProviderVersion: "5.0.0",
			ProviderConfig:  nonZeroRawMessage,
		},
		Type:           "aws_s3_bucket",
		PriorState:     nonZeroRawMessage,
		PlannedState:   nonZeroRawMessage,
		Config:         nonZeroRawMessage,
		PlannedPrivate: []byte("cHJpdmF0ZQ=="),
		RequiresReplace: [][]string{
			{"bucket"},
			{"region"},
		},
	})
}

func TestGoldenResourceImportRequest(t *testing.T) {
	marshalGolden(t, "ResourceImportRequest", types.ResourceImportRequest{
		ProviderRef: types.ProviderRef{
			ProviderSource:  "hashicorp/aws",
			ProviderVersion: "5.0.0",
			ProviderConfig:  nonZeroRawMessage,
		},
		Type:       "aws_s3_bucket",
		ProviderID: "my-bucket",
	})
}

func TestGoldenDataSourceReadRequest(t *testing.T) {
	marshalGolden(t, "DataSourceReadRequest", types.DataSourceReadRequest{
		ProviderRef: types.ProviderRef{
			ProviderSource:  "hashicorp/aws",
			ProviderVersion: "5.0.0",
			ProviderConfig:  nonZeroRawMessage,
		},
		Type:   "aws_caller_identity",
		Config: nonZeroRawMessage,
	})
}

func TestGoldenDiagnostic(t *testing.T) {
	marshalGolden(t, "Diagnostic", types.Diagnostic{
		Severity:  "error",
		Summary:   "something went wrong",
		Detail:    "detailed message",
		Attribute: []string{"root", "config", "region"},
	})
}

func TestGoldenErrorResponse(t *testing.T) {
	marshalGolden(t, "ErrorResponse", types.ErrorResponse{
		Error:             "provider not found",
		Detail:            "check provider source",
		AvailableVersions: []string{"4.0.0", "5.0.0"},
	})
}

func TestGoldenProviderMetadataResponse(t *testing.T) {
	marshalGolden(t, "ProviderMetadataResponse", types.ProviderMetadataResponse{
		ServerCapabilities: types.ProviderServerCapabilities{
			PlanDestroy:               true,
			GetProviderSchemaOptional: false,
			MoveResourceState:         true,
		},
		Diagnostics: []types.Diagnostic{
			{Severity: "warning", Summary: "deprecated field"},
		},
	})
}

func TestGoldenProviderServerCapabilities(t *testing.T) {
	marshalGolden(t, "ProviderServerCapabilities", types.ProviderServerCapabilities{
		PlanDestroy:               true,
		GetProviderSchemaOptional: true,
		MoveResourceState:         false,
	})
}

func TestGoldenSchemaAttribute(t *testing.T) {
	marshalGolden(t, "SchemaAttribute", types.SchemaAttribute{
		Type:           json.RawMessage(`"string"`),
		Description:    "bucket name",
		Required:       true,
		Optional:       false,
		Computed:       false,
		Sensitive:      false,
		DeprecationMsg: "",
	})
}

func TestGoldenResourceSchema(t *testing.T) {
	block := &types.SchemaBlock{
		Attributes: map[string]*types.SchemaAttribute{
			"id": {
				Type:     json.RawMessage(`"string"`),
				Computed: true,
			},
			"bucket": {
				Type:     json.RawMessage(`"string"`),
				Required: true,
			},
		},
		Description: "aws_s3_bucket resource",
	}
	marshalGolden(t, "ResourceSchema", types.ResourceSchema{
		Version: 1,
		Block:   block,
	})
}

func TestGoldenProviderSummaryResponse(t *testing.T) {
	marshalGolden(t, "ProviderSummaryResponse", types.ProviderSummaryResponse{
		ProviderSource:  "hashicorp/aws",
		ProviderVersion: "5.0.0",
		ResourceCount:   2,
		DataSourceCount: 1,
		ServerCapabilities: types.ProviderServerCapabilities{
			PlanDestroy:               true,
			GetProviderSchemaOptional: false,
			MoveResourceState:         true,
		},
		Diagnostics: []types.Diagnostic{
			{Severity: "warning", Summary: "deprecated field"},
		},
	})
}

func TestGoldenProviderTypesSearchResponse(t *testing.T) {
	marshalGolden(t, "ProviderTypesSearchResponse", types.ProviderTypesSearchResponse{
		Results: []types.ProviderTypeSearchHit{
			{Type: "aws_s3_bucket", Kinds: []string{"resource"}},
			{Type: "aws_s3_bucket_object", Kinds: []string{"resource"}},
		},
		Truncated: true,
	})
}

func TestGoldenProviderTypeResolveResponse(t *testing.T) {
	marshalGolden(t, "ProviderTypeResolveResponse", types.ProviderTypeResolveResponse{
		Type:           "aws_s3_bucket",
		Kinds:          []string{"resource", "data"},
		ResourcePath:   "resources/aws_s3_bucket.json",
		DataSourcePath: "data-sources/aws_s3_bucket.json",
	})
}

func TestGoldenProviderTypeSchemaResponse(t *testing.T) {
	block := &types.SchemaBlock{
		Attributes: map[string]*types.SchemaAttribute{
			"region": {
				Type:     json.RawMessage(`"string"`),
				Optional: true,
			},
		},
	}
	schema := &types.ResourceSchema{Version: 0, Block: block}
	marshalGolden(t, "ProviderTypeSchemaResponse", types.ProviderTypeSchemaResponse{
		Type:   "aws_s3_bucket",
		Kind:   "resource",
		Schema: schema,
	})
}

func TestGoldenProviderConfigSchemaResponse(t *testing.T) {
	block := &types.SchemaBlock{
		Attributes: map[string]*types.SchemaAttribute{
			"region": {
				Type:     json.RawMessage(`"string"`),
				Optional: true,
			},
		},
	}
	marshalGolden(t, "ProviderConfigSchemaResponse", types.ProviderConfigSchemaResponse{
		Schema: &types.ResourceSchema{Version: 0, Block: block},
	})
}

func TestGoldenValidateResponse(t *testing.T) {
	marshalGolden(t, "ValidateResponse", types.ValidateResponse{
		Diagnostics: []types.Diagnostic{
			{Severity: "error", Summary: "invalid config"},
		},
	})
}

func TestGoldenResourceReadResponse(t *testing.T) {
	marshalGolden(t, "ResourceReadResponse", types.ResourceReadResponse{
		NewState:    nonZeroRawMessage,
		Private:     []byte("cHJpdmF0ZQ=="),
		Diagnostics: nil,
	})
}

func TestGoldenResourcePlanResponse(t *testing.T) {
	marshalGolden(t, "ResourcePlanResponse", types.ResourcePlanResponse{
		PlannedState:    nonZeroRawMessage,
		PlannedPrivate:  []byte("cHJpdmF0ZQ=="),
		RequiresReplace: [][]string{{"bucket"}},
		Diagnostics:     nil,
	})
}

func TestGoldenResourceApplyResponse(t *testing.T) {
	marshalGolden(t, "ResourceApplyResponse", types.ResourceApplyResponse{
		NewState:    nonZeroRawMessage,
		Private:     []byte("cHJpdmF0ZQ=="),
		Diagnostics: nil,
	})
}

func TestGoldenImportedResource(t *testing.T) {
	marshalGolden(t, "ImportedResource", types.ImportedResource{
		TypeName: "aws_s3_bucket",
		State:    nonZeroRawMessage,
		Private:  []byte("cHJpdmF0ZQ=="),
	})
}

func TestGoldenResourceImportResponse(t *testing.T) {
	marshalGolden(t, "ResourceImportResponse", types.ResourceImportResponse{
		ImportedResources: []types.ImportedResource{
			{
				TypeName: "aws_s3_bucket",
				State:    nonZeroRawMessage,
			},
		},
		Diagnostics: nil,
	})
}

func TestGoldenDataSourceReadResponse(t *testing.T) {
	marshalGolden(t, "DataSourceReadResponse", types.DataSourceReadResponse{
		State:       nonZeroRawMessage,
		Diagnostics: nil,
	})
}
