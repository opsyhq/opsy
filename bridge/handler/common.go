package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/opsydev/opsy/bridge/codec"
	"github.com/opsydev/opsy/bridge/provider"
	"github.com/opsydev/opsy/bridge/respond"
	"github.com/opsydev/opsy/bridge/schema"
	"github.com/opsydev/opsy/bridge/types"
)

// resolveInstance fetches a provider instance from the pool.
func resolveInstance(ctx context.Context, pool *provider.Pool, catalog *schema.Catalog, ref types.ProviderRef) (*provider.Instance, error) {
	schemaType, err := catalog.ProviderSchemaType(ctx, ref.ProviderSource, ref.ProviderVersion)
	if err != nil {
		return nil, err
	}
	return pool.Get(ctx, ref.ProviderSource, ref.ProviderVersion, ref.ProviderConfig, schemaType)
}

func providerSchemaType(ctx context.Context, catalog *schema.Catalog, ref types.ProviderRef) (codec.SchemaType, error) {
	return catalog.ProviderSchemaType(ctx, ref.ProviderSource, ref.ProviderVersion)
}

func resourceSchemaType(ctx context.Context, catalog *schema.Catalog, ref types.ProviderRef, typeName string) (codec.SchemaType, error) {
	return catalog.SchemaType(ctx, ref.ProviderSource, ref.ProviderVersion, "resource", typeName)
}

func dataSourceSchemaType(ctx context.Context, catalog *schema.Catalog, ref types.ProviderRef, typeName string) (codec.SchemaType, error) {
	return catalog.SchemaType(ctx, ref.ProviderSource, ref.ProviderVersion, "data", typeName)
}

const pluginStderrLabel = "\n\nplugin stderr tail:\n"

// writeProviderError writes the appropriate HTTP error for provider-related failures.
func writeProviderError(w http.ResponseWriter, r *http.Request, inst *provider.Instance, err error) {
	var notFound *provider.ErrVersionNotFound
	if errors.As(err, &notFound) {
		respond.VersionNotFoundError(w, err.Error(), notFound.AvailableVersions)
		return
	}
	detail := err.Error()
	pluginExited := inst != nil && inst.PluginExited()
	if pluginExited {
		if tail := inst.StderrTail(); tail != "" {
			detail = detail + pluginStderrLabel + tail
		}
	}
	slog.Error("provider call failed", "path", r.URL.Path, "error", err.Error(), "plugin_exited", pluginExited)
	respond.Error(w, http.StatusBadGateway, "provider unavailable", detail)
}

func writeSchemaError(w http.ResponseWriter, r *http.Request, err error) {
	var notFound *schema.ErrSchemaNotFound
	if errors.As(err, &notFound) {
		respond.Error(w, http.StatusBadRequest, "unknown provider schema", notFound.Error())
		return
	}
	writeProviderError(w, r, nil, err)
}
