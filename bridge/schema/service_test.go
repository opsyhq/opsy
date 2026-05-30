package schema_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	"github.com/hashicorp/terraform-plugin-go/tftypes"
	"github.com/opsydev/opsy/bridge/schema"
	"github.com/opsydev/opsy/bridge/types"
)

func TestSearchTypesReadsManifestOnly(t *testing.T) {
	cacheDir := t.TempDir()
	providerDir := t.TempDir()
	dir, err := schema.CacheDir(cacheDir, "hashicorp/test", "1.0.0")
	if err != nil {
		t.Fatalf("CacheDir: %v", err)
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	manifest := schema.Manifest{
		ProviderSource:  "hashicorp/test",
		ProviderVersion: "1.0.0",
		ProviderPath:    "provider.json",
		ResourceCount:   1,
		DataSourceCount: 1,
		Resources: []schema.ManifestType{
			{Type: "test_bucket", Path: "resources/test_bucket.json", SearchText: "test_bucket test bucket"},
		},
		DataSources: []schema.ManifestType{
			{Type: "test_caller_identity", Path: "data-sources/test_caller_identity.json", SearchText: "test_caller_identity test caller identity"},
		},
	}
	raw, err := json.Marshal(manifest)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "manifest.json"), raw, 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	catalog := schema.New(providerDir, cacheDir, "")
	resp, err := catalog.SearchTypes(context.Background(), types.ProviderTypesSearchRequest{
		ProviderSource:  "hashicorp/test",
		ProviderVersion: "1.0.0",
		Query:           "bucket",
		Kind:            "both",
		Limit:           10,
	})
	if err != nil {
		t.Fatalf("SearchTypes: %v", err)
	}
	if len(resp.Results) != 1 || resp.Results[0].Type != "test_bucket" {
		t.Fatalf("results = %#v, want test_bucket", resp.Results)
	}
}

func TestSearchTypesInstanceReturnsAWSInstance(t *testing.T) {
	catalog := writeSearchCatalog(t, map[string]*tfprotov6.Schema{
		"aws_db_instance": searchSchema("Manages a database instance."),
		"aws_instance":    searchSchema("Manages an EC2 virtual machine."),
	})

	resp := searchResourceTypes(t, catalog, "instance", 10, 0)
	if len(resp.Results) == 0 || resp.Results[0].Type != "aws_instance" {
		t.Fatalf("results = %#v, want aws_instance first", resp.Results)
	}
}

func TestSearchTypesDescriptionOnlyTermsFindType(t *testing.T) {
	catalog := writeSearchCatalog(t, map[string]*tfprotov6.Schema{
		"aws_codestarconnections_connection": searchSchema("Creates a repository link for external systems."),
		"aws_instance":                       searchSchema("Manages an EC2 virtual machine."),
	})

	resp := searchResourceTypes(t, catalog, "repository link", 10, 0)
	if len(resp.Results) != 1 || resp.Results[0].Type != "aws_codestarconnections_connection" {
		t.Fatalf("results = %#v, want aws_codestarconnections_connection", resp.Results)
	}
}

func TestSearchTypesTypeNameMatchesOutrankDescriptionMatches(t *testing.T) {
	catalog := writeSearchCatalog(t, map[string]*tfprotov6.Schema{
		"aws_audit_log": searchSchema("Stores instance telemetry."),
		"aws_instance":  searchSchema("Manages an EC2 virtual machine."),
	})

	resp := searchResourceTypes(t, catalog, "instance", 10, 0)
	if len(resp.Results) != 2 {
		t.Fatalf("results = %#v, want two matches", resp.Results)
	}
	if resp.Results[0].Type != "aws_instance" {
		t.Fatalf("first result = %q, want aws_instance", resp.Results[0].Type)
	}
}

func TestSearchTypesOffsetLimitTruncated(t *testing.T) {
	catalog := writeSearchCatalog(t, map[string]*tfprotov6.Schema{
		"aws_alpha":   searchSchema("Alpha resource."),
		"aws_beta":    searchSchema("Beta resource."),
		"aws_charlie": searchSchema("Charlie resource."),
	})

	resp := searchResourceTypes(t, catalog, "aws", 1, 1)
	if !resp.Truncated {
		t.Fatalf("truncated = false, want true")
	}
	if len(resp.Results) != 1 || resp.Results[0].Type != "aws_beta" {
		t.Fatalf("results = %#v, want aws_beta", resp.Results)
	}
}

func TestReadTypeSchemaProjectsSelectedShard(t *testing.T) {
	cacheDir := t.TempDir()
	providerSource := "hashicorp/test"
	providerVersion := "1.0.0"
	err := schema.WriteCache(cacheDir, providerSource, providerVersion, &tfprotov6.GetProviderSchemaResponse{
		Provider: &tfprotov6.Schema{Block: &tfprotov6.SchemaBlock{}},
		ResourceSchemas: map[string]*tfprotov6.Schema{
			"test_bucket": {
				Version: 2,
				Block: &tfprotov6.SchemaBlock{
					Attributes: []*tfprotov6.SchemaAttribute{
						{Name: "name", Type: tftypes.String, Required: true},
					},
				},
			},
		},
		DataSourceSchemas: map[string]*tfprotov6.Schema{},
	}, nil)
	if err != nil {
		t.Fatalf("WriteCache: %v", err)
	}

	catalog := schema.New(t.TempDir(), cacheDir, "")
	schema, err := catalog.ReadTypeSchema(context.Background(), providerSource, providerVersion, "resource", "test_bucket")
	if err != nil {
		t.Fatalf("ReadTypeSchema: %v", err)
	}
	if schema.Version != 2 {
		t.Fatalf("version = %d, want 2", schema.Version)
	}
	attr := schema.Block.Attributes["name"]
	if attr == nil || !attr.Required || string(attr.Type) != `"string"` {
		t.Fatalf("attribute projection = %#v", attr)
	}
}

func TestEnsureWithoutExtractorPathFailsFast(t *testing.T) {
	catalog := schema.New(t.TempDir(), t.TempDir(), "")
	err := catalog.Ensure(context.Background(), "hashicorp/test", "1.0.0")
	if err == nil {
		t.Fatal("Ensure succeeded without an extractor path")
	}
	if err.Error() != "schema extractor path is empty" {
		t.Fatalf("error = %q, want empty extractor path error", err)
	}
}

func TestWriteCacheReplacesCompleteDirectory(t *testing.T) {
	cacheDir := t.TempDir()
	providerSource := "hashicorp/test"
	providerVersion := "1.0.0"
	base := &tfprotov6.GetProviderSchemaResponse{
		Provider:          &tfprotov6.Schema{Block: &tfprotov6.SchemaBlock{}},
		DataSourceSchemas: map[string]*tfprotov6.Schema{},
	}
	base.ResourceSchemas = map[string]*tfprotov6.Schema{
		"test_old": {Block: &tfprotov6.SchemaBlock{}},
	}
	if err := schema.WriteCache(cacheDir, providerSource, providerVersion, base, nil); err != nil {
		t.Fatalf("WriteCache old: %v", err)
	}
	base.ResourceSchemas = map[string]*tfprotov6.Schema{
		"test_new": {Block: &tfprotov6.SchemaBlock{}},
	}
	if err := schema.WriteCache(cacheDir, providerSource, providerVersion, base, nil); err != nil {
		t.Fatalf("WriteCache new: %v", err)
	}

	dir, err := schema.CacheDir(cacheDir, providerSource, providerVersion)
	if err != nil {
		t.Fatalf("CacheDir: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "resources", "test_old.json")); !os.IsNotExist(err) {
		t.Fatalf("old shard stat error = %v, want not exist", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "resources", "test_new.json")); err != nil {
		t.Fatalf("new shard stat error = %v", err)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "manifest.json"))
	if err != nil {
		t.Fatalf("ReadFile manifest: %v", err)
	}
	var manifest schema.Manifest
	if err := json.Unmarshal(raw, &manifest); err != nil {
		t.Fatalf("Unmarshal manifest: %v", err)
	}
	if len(manifest.Resources) != 1 || manifest.Resources[0].Type != "test_new" {
		t.Fatalf("manifest resources = %#v, want only test_new", manifest.Resources)
	}
}

func TestIdentitySchemaReadsSingleTypeShard(t *testing.T) {
	cacheDir := t.TempDir()
	src, ver := "hashicorp/test", "1.0.0"
	if err := schema.WriteCache(cacheDir, src, ver, &tfprotov6.GetProviderSchemaResponse{
		Provider: &tfprotov6.Schema{Block: &tfprotov6.SchemaBlock{}},
		ResourceSchemas: map[string]*tfprotov6.Schema{
			"test_bucket": {Block: &tfprotov6.SchemaBlock{}},
			"test_thing":  {Block: &tfprotov6.SchemaBlock{}},
		},
		DataSourceSchemas: map[string]*tfprotov6.Schema{},
	}, map[string]*tfprotov6.ResourceIdentitySchema{
		"test_bucket": {
			Version: 1,
			IdentityAttributes: []*tfprotov6.ResourceIdentitySchemaAttribute{
				{Name: "bucket", Type: tftypes.String, RequiredForImport: true, Description: "the bucket name"},
				{Name: "region", Type: tftypes.String, OptionalForImport: true},
			},
		},
	}); err != nil {
		t.Fatalf("WriteCache: %v", err)
	}
	catalog := schema.New(t.TempDir(), cacheDir, "")

	got, err := catalog.IdentitySchema(context.Background(), src, ver, "test_bucket")
	if err != nil {
		t.Fatalf("IdentitySchema(test_bucket): %v", err)
	}
	if got == nil || got.Version != 1 || len(got.Attributes) != 2 {
		t.Fatalf("IdentitySchema(test_bucket) = %#v, want version 1 with 2 attributes", got)
	}
	if got.Attributes[0].Name != "bucket" || !got.Attributes[0].RequiredForImport ||
		got.Attributes[0].Description != "the bucket name" {
		t.Fatalf("bucket attribute = %#v", got.Attributes[0])
	}
	if string(got.Attributes[0].Type) != `"string"` {
		t.Fatalf("bucket attribute type = %s, want \"string\"", got.Attributes[0].Type)
	}
	if got.Attributes[1].Name != "region" || !got.Attributes[1].OptionalForImport {
		t.Fatalf("region attribute = %#v", got.Attributes[1])
	}

	// Type exists but the provider advertised no identity: nil schema, no
	// error, so the caller falls back to a raw import ID.
	noIdentity, err := catalog.IdentitySchema(context.Background(), src, ver, "test_thing")
	if err != nil {
		t.Fatalf("IdentitySchema(test_thing): %v", err)
	}
	if noIdentity != nil {
		t.Fatalf("IdentitySchema(test_thing) = %#v, want nil", noIdentity)
	}

	if _, err := catalog.IdentitySchema(context.Background(), src, ver, "test_unknown"); err == nil {
		t.Fatalf("IdentitySchema(test_unknown) error = nil, want ErrSchemaNotFound")
	}
}

func writeSearchCatalog(t *testing.T, resources map[string]*tfprotov6.Schema) *schema.Catalog {
	t.Helper()
	cacheDir := t.TempDir()
	if err := schema.WriteCache(cacheDir, "hashicorp/aws", "5.0.0", &tfprotov6.GetProviderSchemaResponse{
		Provider:          &tfprotov6.Schema{Block: &tfprotov6.SchemaBlock{}},
		ResourceSchemas:   resources,
		DataSourceSchemas: map[string]*tfprotov6.Schema{},
	}, nil); err != nil {
		t.Fatalf("WriteCache: %v", err)
	}
	return schema.New(t.TempDir(), cacheDir, "")
}

func searchResourceTypes(t *testing.T, catalog *schema.Catalog, query string, limit, offset int) *types.ProviderTypesSearchResponse {
	t.Helper()
	resp, err := catalog.SearchTypes(context.Background(), types.ProviderTypesSearchRequest{
		ProviderSource:  "hashicorp/aws",
		ProviderVersion: "5.0.0",
		Query:           query,
		Kind:            "resource",
		Limit:           limit,
		Offset:          offset,
	})
	if err != nil {
		t.Fatalf("SearchTypes: %v", err)
	}
	return resp
}

func searchSchema(description string) *tfprotov6.Schema {
	return &tfprotov6.Schema{Block: &tfprotov6.SchemaBlock{Description: description}}
}
