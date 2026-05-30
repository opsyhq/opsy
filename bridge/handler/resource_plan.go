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

// ResourcePlan handles POST /resources/plan.
type ResourcePlan struct {
	Pool    *provider.Pool
	Catalog *schema.Catalog
}

func (h *ResourcePlan) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req types.ResourcePlanRequest
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

	priorDV, err := codec.JSONToDynamicValue(req.PriorState, schemaType)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "encoding error (prior_state)", err.Error())
		return
	}
	proposedDV, err := codec.JSONToDynamicValue(req.ProposedNewState, schemaType)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "encoding error (proposed_new_state)", err.Error())
		return
	}
	configDV, err := codec.JSONToDynamicValue(req.Config, schemaType)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "encoding error (config)", err.Error())
		return
	}

	result, err := inst.Call(r.Context(), func(grpc tfprotov6.ProviderServer) (any, error) {
		return grpc.PlanResourceChange(r.Context(), &tfprotov6.PlanResourceChangeRequest{
			TypeName:         req.Type,
			PriorState:       priorDV,
			ProposedNewState: proposedDV,
			Config:           configDV,
			PriorPrivate:     req.PriorPrivate,
		})
	})
	if err != nil {
		writeProviderError(w, r, inst, err)
		return
	}

	resp := result.(*tfprotov6.PlanResourceChangeResponse)
	plannedJSON, err := codec.DynamicValueToJSON(resp.PlannedState, schemaType.Type)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "decoding error", err.Error())
		return
	}

	respond.JSON(w, http.StatusOK, types.ResourcePlanResponse{
		PlannedState:    plannedJSON,
		PlannedPrivate:  resp.PlannedPrivate,
		RequiresReplace: respond.ConvertAttributePaths(resp.RequiresReplace),
		Diagnostics:     respond.ConvertDiagnostics(resp.Diagnostics),
	})
}
