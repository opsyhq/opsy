package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"time"

	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	"github.com/opsydev/opsy/bridge/codec"
	"github.com/opsydev/opsy/bridge/internal/staleplan"
	"github.com/opsydev/opsy/bridge/provider"
	"github.com/opsydev/opsy/bridge/respond"
	"github.com/opsydev/opsy/bridge/schema"
	"github.com/opsydev/opsy/bridge/types"
)

// Backstop for apply — without it, context.WithoutCancel could let a wedged
// provider hold its pool slot forever.
const applyMaxDuration = 10 * time.Minute

type ResourceApply struct {
	Pool    *provider.Pool
	Catalog *schema.Catalog
}

func (h *ResourceApply) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req types.ResourceApplyRequest
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
	plannedDV, err := codec.JSONToDynamicValue(req.PlannedState, schemaType)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "encoding error (planned_state)", err.Error())
		return
	}
	configDV, err := codec.JSONToDynamicValue(req.Config, schemaType)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "encoding error (config)", err.Error())
		return
	}

	// Creates have no prior state to read or drift-check.
	if staleplan.IsNullJSON(req.PriorState) {
		applyAndRespond(w, r, inst, req.Type, schemaType, priorDV, plannedDV, configDV, req.PlannedPrivate)
		return
	}

	readResult, err := inst.Call(r.Context(), func(grpc tfprotov6.ProviderServer) (any, error) {
		return grpc.ReadResource(r.Context(), &tfprotov6.ReadResourceRequest{
			TypeName:     req.Type,
			CurrentState: priorDV,
			Private:      req.PlannedPrivate,
		})
	})
	if err != nil {
		writeProviderError(w, r, inst, err)
		return
	}
	readResp := readResult.(*tfprotov6.ReadResourceResponse)

	rePlanResult, err := inst.Call(r.Context(), func(grpc tfprotov6.ProviderServer) (any, error) {
		return grpc.PlanResourceChange(r.Context(), &tfprotov6.PlanResourceChangeRequest{
			TypeName:         req.Type,
			PriorState:       readResp.NewState,
			ProposedNewState: plannedDV,
			Config:           configDV,
			PriorPrivate:     readResp.Private,
		})
	})
	if err != nil {
		writeProviderError(w, r, inst, err)
		return
	}
	rePlan := rePlanResult.(*tfprotov6.PlanResourceChangeResponse)

	storedAction := staleplan.DeriveAction(req.PriorState, req.PlannedState)
	// A stored update with requires_replace must be promoted before comparing,
	// otherwise a re-plan that also yields replace is falsely flagged stale.
	if storedAction == staleplan.ActionUpdate && len(req.RequiresReplace) > 0 {
		storedAction = staleplan.ActionReplace
	}
	rePlanAction := staleplan.DeriveActionFromDV(readResp.NewState, rePlan.PlannedState, rePlan.RequiresReplace)

	if staleplan.Diverged(storedAction, rePlanAction) {
		respond.JSON(w, http.StatusOK, types.ResourceApplyResponse{
			Diagnostics: []types.Diagnostic{{
				Severity: "error",
				Summary:  "Stale plan",
				Detail: "The plan has diverged from the current state of the resource. " +
					"Stored action: " + string(storedAction) + ", re-planned action: " + string(rePlanAction) + ". " +
					"Re-run the plan before applying.",
			}},
		})
		return
	}

	// Provider SDKs dispatch ApplyResourceChange by null-ness of prior/planned
	// (both non-null → Update, prior null → Create, planned null → Delete).
	// ForceNew fields have no Update path, so a single Apply with both states
	// non-null silently no-ops. Mirror Terraform Core: decompose replace into
	// destroy then create.
	if len(rePlan.RequiresReplace) > 0 {
		applyReplaceAndRespond(w, r, inst, req.Type, schemaType,
			readResp.NewState, configDV, readResp.Private)
		return
	}

	// Apply the re-plan output, not the original stored plan.
	applyAndRespond(w, r, inst, req.Type, schemaType,
		readResp.NewState, rePlan.PlannedState, configDV, rePlan.PlannedPrivate)
}

// Apply runs under context.WithoutCancel: once the RPC is in flight the
// cloud-side mutation may already have committed, and tearing down the gRPC
// channel on HTTP cancellation would yield EOF while the change persists.
func applyAndRespond(
	w http.ResponseWriter, r *http.Request,
	inst *provider.Instance,
	typeName string,
	schemaType codec.SchemaType,
	priorDV, plannedDV, configDV *tfprotov6.DynamicValue,
	plannedPrivate []byte,
) {
	applyCtx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), applyMaxDuration)
	defer cancel()
	result, err := inst.Call(applyCtx, func(grpc tfprotov6.ProviderServer) (any, error) {
		return grpc.ApplyResourceChange(applyCtx, &tfprotov6.ApplyResourceChangeRequest{
			TypeName:       typeName,
			PriorState:     priorDV,
			PlannedState:   plannedDV,
			Config:         configDV,
			PlannedPrivate: plannedPrivate,
		})
	})
	if err != nil {
		writeProviderError(w, r, inst, err)
		return
	}
	applyResp := result.(*tfprotov6.ApplyResourceChangeResponse)

	newStateJSON, err := codec.DynamicValueToJSON(applyResp.NewState, schemaType.Type)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "decoding error", err.Error())
		return
	}

	respond.JSON(w, http.StatusOK, types.ResourceApplyResponse{
		NewState:    newStateJSON,
		Private:     applyResp.Private,
		Diagnostics: respond.ConvertDiagnostics(applyResp.Diagnostics),
	})
}

// applyReplaceAndRespond decomposes a replace into destroy + create. Provider
// SDKs have no ForceNew Update path, so a single Apply would silently no-op;
// each phase needs its own Plan to get phase-specific PlannedPrivate.
func applyReplaceAndRespond(
	w http.ResponseWriter, r *http.Request,
	inst *provider.Instance,
	typeName string,
	schemaType codec.SchemaType,
	priorDV, configDV *tfprotov6.DynamicValue,
	priorPrivate []byte,
) {
	applyCtx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), applyMaxDuration)
	defer cancel()

	nullDV, err := codec.JSONToDynamicValue(json.RawMessage("null"), schemaType)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "encoding error (null state)", err.Error())
		return
	}

	destroyPlanResult, err := inst.Call(applyCtx, func(grpc tfprotov6.ProviderServer) (any, error) {
		return grpc.PlanResourceChange(applyCtx, &tfprotov6.PlanResourceChangeRequest{
			TypeName:         typeName,
			PriorState:       priorDV,
			ProposedNewState: nullDV,
			Config:           nullDV,
			PriorPrivate:     priorPrivate,
		})
	})
	if err != nil {
		writeProviderError(w, r, inst, err)
		return
	}
	destroyPlan := destroyPlanResult.(*tfprotov6.PlanResourceChangeResponse)
	if len(provider.FatalDiags(destroyPlan.Diagnostics)) > 0 {
		respond.JSON(w, http.StatusOK, types.ResourceApplyResponse{
			Diagnostics: respond.ConvertDiagnostics(destroyPlan.Diagnostics),
		})
		return
	}

	destroyApplyResult, err := inst.Call(applyCtx, func(grpc tfprotov6.ProviderServer) (any, error) {
		return grpc.ApplyResourceChange(applyCtx, &tfprotov6.ApplyResourceChangeRequest{
			TypeName:       typeName,
			PriorState:     priorDV,
			PlannedState:   destroyPlan.PlannedState,
			Config:         nullDV,
			PlannedPrivate: destroyPlan.PlannedPrivate,
		})
	})
	if err != nil {
		writeProviderError(w, r, inst, err)
		return
	}
	destroyApply := destroyApplyResult.(*tfprotov6.ApplyResourceChangeResponse)
	if len(provider.FatalDiags(destroyApply.Diagnostics)) > 0 {
		respond.JSON(w, http.StatusOK, types.ResourceApplyResponse{
			Diagnostics: respond.ConvertDiagnostics(destroyApply.Diagnostics),
		})
		return
	}

	createPlanResult, err := inst.Call(applyCtx, func(grpc tfprotov6.ProviderServer) (any, error) {
		return grpc.PlanResourceChange(applyCtx, &tfprotov6.PlanResourceChangeRequest{
			TypeName:         typeName,
			PriorState:       nullDV,
			ProposedNewState: configDV,
			Config:           configDV,
			PriorPrivate:     nil,
		})
	})
	if err != nil {
		writeProviderError(w, r, inst, err)
		return
	}
	createPlan := createPlanResult.(*tfprotov6.PlanResourceChangeResponse)
	if len(provider.FatalDiags(createPlan.Diagnostics)) > 0 {
		respond.JSON(w, http.StatusOK, types.ResourceApplyResponse{
			Diagnostics: respond.ConvertDiagnostics(slices.Concat(destroyApply.Diagnostics, createPlan.Diagnostics)),
		})
		return
	}

	createApplyResult, err := inst.Call(applyCtx, func(grpc tfprotov6.ProviderServer) (any, error) {
		return grpc.ApplyResourceChange(applyCtx, &tfprotov6.ApplyResourceChangeRequest{
			TypeName:       typeName,
			PriorState:     nullDV,
			PlannedState:   createPlan.PlannedState,
			Config:         configDV,
			PlannedPrivate: createPlan.PlannedPrivate,
		})
	})
	if err != nil {
		writeProviderError(w, r, inst, err)
		return
	}
	createApply := createApplyResult.(*tfprotov6.ApplyResourceChangeResponse)

	newStateJSON, err := codec.DynamicValueToJSON(createApply.NewState, schemaType.Type)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "decoding error", err.Error())
		return
	}

	respond.JSON(w, http.StatusOK, types.ResourceApplyResponse{
		NewState:    newStateJSON,
		Private:     createApply.Private,
		Diagnostics: respond.ConvertDiagnostics(slices.Concat(destroyApply.Diagnostics, createApply.Diagnostics)),
	})
}
