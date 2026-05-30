package handler

import (
	"encoding/json"
	"net/http"

	"github.com/opsydev/opsy/bridge/respond"
	"github.com/opsydev/opsy/bridge/schema"
	"github.com/opsydev/opsy/bridge/types"
)

// ProviderMetadata handles POST /providers/metadata.
// Returns server capabilities reported by the provider.
type ProviderMetadata struct {
	Catalog *schema.Catalog
}

func (h *ProviderMetadata) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req types.ProviderMetadataRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	summary, err := h.Catalog.Summary(r.Context(), req.ProviderSource, req.ProviderVersion)
	if err != nil {
		writeSchemaError(w, r, err)
		return
	}
	respond.JSON(w, http.StatusOK, types.ProviderMetadataResponse{
		ServerCapabilities: summary.ServerCapabilities,
		Diagnostics:        summary.Diagnostics,
	})
}
