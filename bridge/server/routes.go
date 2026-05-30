package server

import (
	"github.com/go-chi/chi/v5"
	"github.com/opsydev/opsy/bridge/handler"
	"github.com/opsydev/opsy/bridge/provider"
	"github.com/opsydev/opsy/bridge/schema"
)

// registerRoutes wires all handler endpoints onto the router.
func registerRoutes(r chi.Router, pool *provider.Pool, catalog *schema.Catalog) {
	r.Post("/providers/metadata", (&handler.ProviderMetadata{Catalog: catalog}).ServeHTTP)
	r.Post("/providers/summary", (&handler.ProviderSummary{Catalog: catalog}).ServeHTTP)
	r.Post("/providers/types/search", (&handler.ProviderTypesSearch{Catalog: catalog}).ServeHTTP)
	r.Post("/providers/types/resolve", (&handler.ProviderTypeResolve{Catalog: catalog}).ServeHTTP)
	r.Post("/providers/types/schema", (&handler.ProviderTypeSchema{Catalog: catalog}).ServeHTTP)
	r.Post("/providers/types/identity", (&handler.ProviderTypeIdentity{Catalog: catalog}).ServeHTTP)
	r.Post("/providers/config-schema", (&handler.ProviderConfigSchema{Catalog: catalog}).ServeHTTP)
	r.Post("/providers/validate-config", (&handler.ProviderValidate{Pool: pool, Catalog: catalog}).ServeHTTP)

	r.Post("/resources/validate-config", (&handler.ResourceValidate{Pool: pool, Catalog: catalog}).ServeHTTP)
	r.Post("/resources/read", (&handler.ResourceRead{Pool: pool, Catalog: catalog}).ServeHTTP)
	r.Post("/resources/plan", (&handler.ResourcePlan{Pool: pool, Catalog: catalog}).ServeHTTP)
	r.Post("/resources/apply", (&handler.ResourceApply{Pool: pool, Catalog: catalog}).ServeHTTP)
	r.Post("/resources/import", (&handler.ResourceImport{Pool: pool, Catalog: catalog}).ServeHTTP)

	r.Post("/data-sources/read", (&handler.DataSourceRead{Pool: pool, Catalog: catalog}).ServeHTTP)
}
