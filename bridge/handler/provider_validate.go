package handler

import (
	"encoding/json"
	"net/http"

	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	"github.com/opsydev/opsy/bridge/codec"
	"github.com/opsydev/opsy/bridge/provider"
	"github.com/opsydev/opsy/bridge/respond"
	"github.com/opsydev/opsy/bridge/schema"
	"github.com/opsydev/opsy/bridge/types"
)

// ProviderValidate handles POST /providers/validate-config.
type ProviderValidate struct {
	Pool    *provider.Pool
	Catalog *schema.Catalog
}

func (h *ProviderValidate) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req types.ProviderValidateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	schemaType, err := providerSchemaType(r.Context(), h.Catalog, req.ProviderRef)
	if err != nil {
		writeSchemaError(w, r, err)
		return
	}

	inst, err := h.Pool.Get(r.Context(), req.ProviderSource, req.ProviderVersion, req.ProviderConfig, schemaType)
	if err != nil {
		writeProviderError(w, r, nil, err)
		return
	}

	configDV, err := codec.JSONToDynamicValue(req.ProviderConfig, schemaType)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "encoding error", err.Error())
		return
	}

	result, err := inst.Call(r.Context(), func(grpc tfprotov6.ProviderServer) (any, error) {
		return grpc.ValidateProviderConfig(r.Context(), &tfprotov6.ValidateProviderConfigRequest{
			Config: configDV,
		})
	})
	if err != nil {
		writeProviderError(w, r, inst, err)
		return
	}

	resp := result.(*tfprotov6.ValidateProviderConfigResponse)
	respond.JSON(w, http.StatusOK, types.ValidateResponse{
		Diagnostics: respond.ConvertDiagnostics(resp.Diagnostics),
	})
}
