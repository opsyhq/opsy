package schema

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
)

func WriteCache(root, providerSource, providerVersion string, schema *tfprotov6.GetProviderSchemaResponse, identitySchemas map[string]*tfprotov6.ResourceIdentitySchema) error {
	finalDir, err := CacheDir(root, providerSource, providerVersion)
	if err != nil {
		return err
	}
	parent := filepath.Dir(finalDir)
	if err := os.MkdirAll(parent, 0o755); err != nil {
		return fmt.Errorf("create schema cache parent dir: %w", err)
	}
	staging, err := os.MkdirTemp(parent, "."+filepath.Base(finalDir)+".tmp-*")
	if err != nil {
		return fmt.Errorf("create schema cache staging dir: %w", err)
	}
	defer func() {
		if staging != "" {
			_ = os.RemoveAll(staging)
		}
	}()
	if err := writeCacheContents(staging, providerSource, providerVersion, schema, identitySchemas); err != nil {
		return err
	}
	if err := publishCacheDir(staging, finalDir); err != nil {
		return err
	}
	staging = ""
	return nil
}

func writeCacheContents(dir, providerSource, providerVersion string, schema *tfprotov6.GetProviderSchemaResponse, identitySchemas map[string]*tfprotov6.ResourceIdentitySchema) error {
	if err := os.MkdirAll(filepath.Join(dir, "resources"), 0o755); err != nil {
		return fmt.Errorf("create resource schema cache dir: %w", err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "data-sources"), 0o755); err != nil {
		return fmt.Errorf("create data source schema cache dir: %w", err)
	}

	providerShard, err := ShardFromTF(providerSource, providerVersion, KindProvider, "", schema.Provider)
	if err != nil {
		return fmt.Errorf("convert provider schema: %w", err)
	}
	if err := writeJSON(filepath.Join(dir, ProviderPath()), providerShard); err != nil {
		return err
	}

	if schema.ProviderMeta != nil {
		providerMetaShard, err := ShardFromTF(providerSource, providerVersion, KindProviderMeta, "", schema.ProviderMeta)
		if err != nil {
			return fmt.Errorf("convert provider meta schema: %w", err)
		}
		if err := writeJSON(filepath.Join(dir, ProviderMetaPath()), providerMetaShard); err != nil {
			return err
		}
	}

	// Identity rides along inside each resource's own shard so the import
	// flow reads exactly one already-cached per-type file — never the full
	// provider's identity set — to answer "how is this type imported".
	identity, err := IdentitySchemasFromTF(identitySchemas)
	if err != nil {
		return fmt.Errorf("convert resource identity schemas: %w", err)
	}

	for typeName, resourceSchema := range schema.ResourceSchemas {
		rel, err := TypePath(KindResource, typeName)
		if err != nil {
			return err
		}
		shard, err := ShardFromTF(providerSource, providerVersion, KindResource, typeName, resourceSchema)
		if err != nil {
			return fmt.Errorf("convert resource schema %q: %w", typeName, err)
		}
		if schema, ok := identity[typeName]; ok {
			shard.Identity = &schema
		}
		if err := writeJSON(filepath.Join(dir, filepath.FromSlash(rel)), shard); err != nil {
			return err
		}
	}

	for typeName, dataSourceSchema := range schema.DataSourceSchemas {
		rel, err := TypePath(KindDataSource, typeName)
		if err != nil {
			return err
		}
		shard, err := ShardFromTF(providerSource, providerVersion, KindDataSource, typeName, dataSourceSchema)
		if err != nil {
			return fmt.Errorf("convert data source schema %q: %w", typeName, err)
		}
		if err := writeJSON(filepath.Join(dir, filepath.FromSlash(rel)), shard); err != nil {
			return err
		}
	}

	return writeJSON(filepath.Join(dir, "manifest.json"), NewManifest(providerSource, providerVersion, schema))
}

func publishCacheDir(staging, finalDir string) error {
	if _, err := os.Stat(finalDir); err != nil {
		if !os.IsNotExist(err) {
			return fmt.Errorf("stat schema cache dir: %w", err)
		}
		if err := os.Rename(staging, finalDir); err != nil {
			return fmt.Errorf("publish schema cache dir: %w", err)
		}
		return nil
	}

	backup := filepath.Join(
		filepath.Dir(finalDir),
		fmt.Sprintf(".%s.old-%d-%d", filepath.Base(finalDir), os.Getpid(), time.Now().UnixNano()),
	)
	if err := os.Rename(finalDir, backup); err != nil {
		return fmt.Errorf("stage existing schema cache dir: %w", err)
	}
	if err := os.Rename(staging, finalDir); err != nil {
		if restoreErr := os.Rename(backup, finalDir); restoreErr != nil {
			return fmt.Errorf("publish schema cache dir: %w; restore previous schema cache dir: %v", err, restoreErr)
		}
		return fmt.Errorf("publish schema cache dir: %w", err)
	}
	if err := os.RemoveAll(backup); err != nil {
		return fmt.Errorf("remove previous schema cache dir: %w", err)
	}
	return nil
}

func writeJSON(filename string, v any) error {
	if err := os.MkdirAll(filepath.Dir(filename), 0o755); err != nil {
		return fmt.Errorf("create schema cache directory for %s: %w", filename, err)
	}
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal schema cache file %s: %w", filename, err)
	}
	data = append(data, '\n')
	if err := os.WriteFile(filename, data, 0o644); err != nil {
		return fmt.Errorf("write schema cache file %s: %w", filename, err)
	}
	return nil
}
