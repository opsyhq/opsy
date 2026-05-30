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

// ResourceRead handles POST /resources/read.
type ResourceRead struct {
	Pool    *provider.Pool
	Catalog *schema.Catalog
}

func (h *ResourceRead) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req types.ResourceReadRequest
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
	currentDV, err := codec.JSONToDynamicValue(req.CurrentState, schemaType)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "encoding error", err.Error())
		return
	}

	result, err := inst.Call(r.Context(), func(grpc tfprotov6.ProviderServer) (any, error) {
		return grpc.ReadResource(r.Context(), &tfprotov6.ReadResourceRequest{
			TypeName:     req.Type,
			CurrentState: currentDV,
			Private:      req.Private,
		})
	})
	if err != nil {
		writeProviderError(w, r, inst, err)
		return
	}

	resp := result.(*tfprotov6.ReadResourceResponse)
	newStateJSON, err := codec.DynamicValueToJSON(resp.NewState, schemaType.Type)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "decoding error", err.Error())
		return
	}

	respond.JSON(w, http.StatusOK, types.ResourceReadResponse{
		NewState:    newStateJSON,
		Private:     resp.Private,
		Diagnostics: respond.ConvertDiagnostics(resp.Diagnostics),
	})
}
