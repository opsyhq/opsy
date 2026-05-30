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

// ResourceValidate handles POST /resources/validate-config.
type ResourceValidate struct {
	Pool    *provider.Pool
	Catalog *schema.Catalog
}

func (h *ResourceValidate) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req types.ResourceValidateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	schemaType, err := resourceSchemaType(r.Context(), h.Catalog, req.ProviderRef, req.Type)
	if err != nil {
		writeSchemaError(w, r, err)
		return
	}

	inst, err := resolveInstance(r.Context(), h.Pool, h.Catalog, req.ProviderRef)
	if err != nil {
		writeProviderError(w, r, nil, err)
		return
	}
	configDV, err := codec.JSONToDynamicValue(req.Config, schemaType)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "encoding error", err.Error())
		return
	}

	result, err := inst.Call(r.Context(), func(grpc tfprotov6.ProviderServer) (any, error) {
		return grpc.ValidateResourceConfig(r.Context(), &tfprotov6.ValidateResourceConfigRequest{
			TypeName: req.Type,
			Config:   configDV,
		})
	})
	if err != nil {
		writeProviderError(w, r, inst, err)
		return
	}

	resp := result.(*tfprotov6.ValidateResourceConfigResponse)
	respond.JSON(w, http.StatusOK, types.ValidateResponse{
		Diagnostics: respond.ConvertDiagnostics(resp.Diagnostics),
	})
}
