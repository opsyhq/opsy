package schema

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/sync/singleflight"

	"github.com/opsydev/opsy/bridge/codec"
	"github.com/opsydev/opsy/bridge/types"
)

type Catalog struct {
	providerDir string
	cacheDir    string
	extractor   Extractor
	sf          singleflight.Group
}

type Extractor func(ctx context.Context, providerSource, providerVersion string) error

type ErrSchemaNotFound struct {
	Kind string
	Type string
}

func (e *ErrSchemaNotFound) Error() string {
	if e.Kind == "" {
		return fmt.Sprintf("unknown provider type %q", e.Type)
	}
	return fmt.Sprintf("unknown %s schema for type %q", e.Kind, e.Type)
}

func New(providerDir, cacheDir, extractor string) *Catalog {
	return NewWithExtractor(providerDir, cacheDir, commandExtractor(providerDir, cacheDir, extractor))
}

func NewWithExtractor(providerDir, cacheDir string, extractor Extractor) *Catalog {
	return &Catalog{
		providerDir: providerDir,
		cacheDir:    cacheDir,
		extractor:   extractor,
	}
}

func (c *Catalog) Ensure(ctx context.Context, providerSource, providerVersion string) error {
	manifestPath, err := ManifestPath(c.cacheDir, providerSource, providerVersion)
	if err != nil {
		return err
	}
	if _, err := os.Stat(manifestPath); err == nil {
		return nil
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("stat schema manifest: %w", err)
	}

	key := providerSource + "\x00" + providerVersion
	_, err, _ = c.sf.Do(key, func() (any, error) {
		if _, err := os.Stat(manifestPath); err == nil {
			return nil, nil
		} else if !os.IsNotExist(err) {
			return nil, fmt.Errorf("stat schema manifest: %w", err)
		}
		if c.extractor == nil {
			return nil, fmt.Errorf("schema extractor is not configured")
		}
		return nil, c.extractor(ctx, providerSource, providerVersion)
	})
	return err
}

func (c *Catalog) Summary(ctx context.Context, providerSource, providerVersion string) (*types.ProviderSummaryResponse, error) {
	manifest, err := c.readManifest(ctx, providerSource, providerVersion)
	if err != nil {
		return nil, err
	}
	resp := &types.ProviderSummaryResponse{
		ProviderSource:  manifest.ProviderSource,
		ProviderVersion: manifest.ProviderVersion,
		ResourceCount:   manifest.ResourceCount,
		DataSourceCount: manifest.DataSourceCount,
		Diagnostics:     DiagnosticsToWire(manifest.Diagnostics),
	}
	if manifest.ServerCapabilities != nil {
		resp.ServerCapabilities = types.ProviderServerCapabilities{
			PlanDestroy:               manifest.ServerCapabilities.PlanDestroy,
			GetProviderSchemaOptional: manifest.ServerCapabilities.GetProviderSchemaOptional,
			MoveResourceState:         manifest.ServerCapabilities.MoveResourceState,
		}
	}
	return resp, nil
}

func (c *Catalog) SearchTypes(ctx context.Context, req types.ProviderTypesSearchRequest) (*types.ProviderTypesSearchResponse, error) {
	manifest, err := c.readManifest(ctx, req.ProviderSource, req.ProviderVersion)
	if err != nil {
		return nil, err
	}
	kind := req.Kind
	if kind == "" {
		kind = "both"
	}
	limit := req.Limit
	if limit <= 0 {
		limit = 25
	}
	if limit > 100 {
		limit = 100
	}
	offset := req.Offset
	if offset < 0 {
		offset = 0
	}

	type candidate struct {
		typeName string
		kinds    map[string]bool
		score    int
	}
	candidates := map[string]*candidate{}
	add := func(kind string, entries []ManifestType) {
		for _, entry := range entries {
			score := scoreSearch(entry.Type, entry.SearchText, req.Query)
			if score == 0 {
				continue
			}
			c := candidates[entry.Type]
			if c == nil {
				c = &candidate{typeName: entry.Type, kinds: map[string]bool{}, score: score}
				candidates[entry.Type] = c
			}
			c.kinds[kind] = true
			if score > c.score {
				c.score = score
			}
		}
	}
	if kind == "resource" || kind == "both" {
		add("resource", manifest.Resources)
	}
	if kind == "data" || kind == "both" {
		add("data", manifest.DataSources)
	}

	list := make([]*candidate, 0, len(candidates))
	for _, c := range candidates {
		list = append(list, c)
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].score != list[j].score {
			return list[i].score > list[j].score
		}
		return list[i].typeName < list[j].typeName
	})
	truncated := len(list) > offset+limit
	end := offset + limit
	if end > len(list) {
		end = len(list)
	}
	if offset > len(list) {
		offset = len(list)
	}
	page := list[offset:end]
	results := make([]types.ProviderTypeSearchHit, 0, len(page))
	for _, hit := range page {
		kinds := make([]string, 0, 2)
		if hit.kinds["resource"] {
			kinds = append(kinds, "resource")
		}
		if hit.kinds["data"] {
			kinds = append(kinds, "data")
		}
		results = append(results, types.ProviderTypeSearchHit{Type: hit.typeName, Kinds: kinds})
	}
	return &types.ProviderTypesSearchResponse{Results: results, Truncated: truncated}, nil
}

func (c *Catalog) ResolveType(ctx context.Context, providerSource, providerVersion, typeName string) (*types.ProviderTypeResolveResponse, error) {
	manifest, err := c.readManifest(ctx, providerSource, providerVersion)
	if err != nil {
		return nil, err
	}
	resp := &types.ProviderTypeResolveResponse{Type: typeName}
	for _, entry := range manifest.Resources {
		if entry.Type == typeName {
			resp.Kinds = append(resp.Kinds, "resource")
			resp.ResourcePath = entry.Path
			break
		}
	}
	for _, entry := range manifest.DataSources {
		if entry.Type == typeName {
			resp.Kinds = append(resp.Kinds, "data")
			resp.DataSourcePath = entry.Path
			break
		}
	}
	if len(resp.Kinds) == 0 {
		return nil, &ErrSchemaNotFound{Type: typeName}
	}
	return resp, nil
}

func (c *Catalog) ReadProviderSchema(ctx context.Context, providerSource, providerVersion string) (*types.ResourceSchema, error) {
	shard, err := c.readShard(ctx, providerSource, providerVersion, ProviderPath())
	if err != nil {
		return nil, err
	}
	return ToResourceSchema(shard.Schema)
}

func (c *Catalog) ReadTypeSchema(ctx context.Context, providerSource, providerVersion, kind, typeName string) (*types.ResourceSchema, error) {
	shard, err := c.readTypeShard(ctx, providerSource, providerVersion, kind, typeName)
	if err != nil {
		return nil, err
	}
	return ToResourceSchema(shard.Schema)
}

// IdentitySchema returns the import-identity schema for one resource type,
// reading only that type's already-cached shard. A nil schema with no error
// means the type exists but the provider advertises no structured identity:
// the caller must fall back to a raw Terraform import ID. An unknown type
// yields ErrSchemaNotFound.
func (c *Catalog) IdentitySchema(ctx context.Context, providerSource, providerVersion, typeName string) (*types.ResourceIdentitySchema, error) {
	shard, err := c.readTypeShard(ctx, providerSource, providerVersion, "resource", typeName)
	if err != nil {
		return nil, err
	}
	return shard.Identity, nil
}

func (c *Catalog) ProviderSchemaType(ctx context.Context, providerSource, providerVersion string) (codec.SchemaType, error) {
	shard, err := c.readShard(ctx, providerSource, providerVersion, ProviderPath())
	if err != nil {
		return codec.SchemaType{}, err
	}
	return ToSchemaType(shard.Schema)
}

func (c *Catalog) SchemaType(ctx context.Context, providerSource, providerVersion, kind, typeName string) (codec.SchemaType, error) {
	shard, err := c.readTypeShard(ctx, providerSource, providerVersion, kind, typeName)
	if err != nil {
		return codec.SchemaType{}, err
	}
	return ToSchemaType(shard.Schema)
}

func (c *Catalog) readManifest(ctx context.Context, providerSource, providerVersion string) (*Manifest, error) {
	if err := c.Ensure(ctx, providerSource, providerVersion); err != nil {
		return nil, err
	}
	manifestPath, err := ManifestPath(c.cacheDir, providerSource, providerVersion)
	if err != nil {
		return nil, err
	}
	raw, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("read schema manifest: %w", err)
	}
	var manifest Manifest
	if err := json.Unmarshal(raw, &manifest); err != nil {
		return nil, fmt.Errorf("decode schema manifest: %w", err)
	}
	return &manifest, nil
}

func (c *Catalog) readTypeShard(ctx context.Context, providerSource, providerVersion, kind, typeName string) (*Shard, error) {
	manifest, err := c.readManifest(ctx, providerSource, providerVersion)
	if err != nil {
		return nil, err
	}
	var rel string
	switch kind {
	case "resource":
		for _, entry := range manifest.Resources {
			if entry.Type == typeName {
				rel = entry.Path
				break
			}
		}
	case "data":
		for _, entry := range manifest.DataSources {
			if entry.Type == typeName {
				rel = entry.Path
				break
			}
		}
	default:
		return nil, fmt.Errorf("unsupported schema kind %q", kind)
	}
	if rel == "" {
		return nil, &ErrSchemaNotFound{Kind: kind, Type: typeName}
	}
	return c.readShard(ctx, providerSource, providerVersion, rel)
}

func (c *Catalog) readShard(ctx context.Context, providerSource, providerVersion, rel string) (*Shard, error) {
	if err := c.Ensure(ctx, providerSource, providerVersion); err != nil {
		return nil, err
	}
	dir, err := CacheDir(c.cacheDir, providerSource, providerVersion)
	if err != nil {
		return nil, err
	}
	clean := filepath.Clean(filepath.FromSlash(rel))
	if clean == "." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) || filepath.IsAbs(clean) {
		return nil, fmt.Errorf("invalid schema shard path %q", rel)
	}
	raw, err := os.ReadFile(filepath.Join(dir, clean))
	if err != nil {
		return nil, fmt.Errorf("read schema shard %s: %w", rel, err)
	}
	var shard Shard
	if err := json.Unmarshal(raw, &shard); err != nil {
		return nil, fmt.Errorf("decode schema shard %s: %w", rel, err)
	}
	return &shard, nil
}

func commandExtractor(providerDir, cacheDir, extractor string) Extractor {
	return func(ctx context.Context, providerSource, providerVersion string) error {
		if extractor == "" {
			return fmt.Errorf("schema extractor path is empty")
		}
		cmd := exec.CommandContext(ctx, extractor,
			"schema-extract",
			"--provider-dir", providerDir,
			"--schema-cache-dir", cacheDir,
			"--provider-source", providerSource,
			"--provider-version", providerVersion,
		)
		var stderr bytes.Buffer
		cmd.Stderr = &stderr
		if err := cmd.Run(); err != nil {
			detail := strings.TrimSpace(stderr.String())
			if detail != "" {
				return fmt.Errorf("schema extractor failed: %w: %s", err, detail)
			}
			return fmt.Errorf("schema extractor failed: %w", err)
		}
		return nil
	}
}

func scoreSearch(typeName, searchText, query string) int {
	q := strings.TrimSpace(strings.ToLower(query))
	if q == "" {
		return 1
	}
	queryTokens := tokens(q)
	if len(queryTokens) == 0 {
		return 0
	}
	raw := strings.ToLower(typeName)
	haystack := strings.ToLower(strings.TrimSpace(typeName + " " + searchText))
	haystackTokens := tokens(haystack)
	if !allTokensMatch(queryTokens, haystackTokens) {
		return 0
	}
	normalized := strings.Join(queryTokens, "_")
	if raw == normalized {
		return 5000
	}
	if _, suffix, ok := strings.Cut(raw, "_"); ok && suffix == normalized {
		return 4500
	}
	typeTokens := tokens(raw)
	if hasTokenSuffix(typeTokens, queryTokens) {
		return 4000
	}
	if allTokensMatch(queryTokens, typeTokens) {
		return 3000 + tokenMatchScore(queryTokens, typeTokens)
	}
	return 1000 + tokenMatchScore(queryTokens, haystackTokens)
}

func allTokensMatch(queryTokens, haystackTokens []string) bool {
	for _, token := range queryTokens {
		if tokenMatchScore([]string{token}, haystackTokens) == 0 {
			return false
		}
	}
	return true
}

func hasTokenSuffix(typeTokens, suffix []string) bool {
	if len(suffix) == 0 || len(suffix) > len(typeTokens) {
		return false
	}
	for i := range suffix {
		if typeTokens[len(typeTokens)-len(suffix)+i] != suffix[i] {
			return false
		}
	}
	return true
}

func tokenMatchScore(queryTokens, haystackTokens []string) int {
	score := 0
	for _, token := range queryTokens {
		matched := false
		for _, candidate := range haystackTokens {
			switch {
			case candidate == token:
				score += 140
				matched = true
			case strings.HasPrefix(candidate, token):
				score += 90
				matched = true
			case strings.Contains(candidate, token):
				score += 45
				matched = true
			}
			if matched {
				break
			}
		}
		if !matched {
			return 0
		}
	}
	return score
}

func tokens(value string) []string {
	return strings.FieldsFunc(strings.ToLower(value), func(r rune) bool {
		return (r < 'a' || r > 'z') && (r < '0' || r > '9')
	})
}
