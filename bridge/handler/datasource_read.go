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

// DataSourceRead handles POST /data-sources/read.
type DataSourceRead struct {
	Pool    *provider.Pool
	Catalog *schema.Catalog
}

func (h *DataSourceRead) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req types.DataSourceReadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	schemaType, err := dataSourceSchemaType(r.Context(), h.Catalog, req.ProviderRef, req.Type)
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
		return grpc.ReadDataSource(r.Context(), &tfprotov6.ReadDataSourceRequest{
			TypeName: req.Type,
			Config:   configDV,
		})
	})
	if err != nil {
		writeProviderError(w, r, inst, err)
		return
	}

	resp := result.(*tfprotov6.ReadDataSourceResponse)
	stateJSON, err := codec.DynamicValueToJSON(resp.State, schemaType.Type)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "decoding error", err.Error())
		return
	}

	respond.JSON(w, http.StatusOK, types.DataSourceReadResponse{
		State:       stateJSON,
		Diagnostics: respond.ConvertDiagnostics(resp.Diagnostics),
	})
}
