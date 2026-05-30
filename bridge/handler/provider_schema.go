package handler

import (
	"encoding/json"
	"net/http"

	"github.com/opsydev/opsy/bridge/respond"
	"github.com/opsydev/opsy/bridge/schema"
	"github.com/opsydev/opsy/bridge/types"
)

type ProviderSummary struct {
	Catalog *schema.Catalog
}

func (h *ProviderSummary) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req types.ProviderSummaryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}
	resp, err := h.Catalog.Summary(r.Context(), req.ProviderSource, req.ProviderVersion)
	if err != nil {
		writeSchemaError(w, r, err)
		return
	}
	respond.JSON(w, http.StatusOK, resp)
}

type ProviderTypesSearch struct {
	Catalog *schema.Catalog
}

func (h *ProviderTypesSearch) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req types.ProviderTypesSearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}
	resp, err := h.Catalog.SearchTypes(r.Context(), req)
	if err != nil {
		writeSchemaError(w, r, err)
		return
	}
	respond.JSON(w, http.StatusOK, resp)
}

type ProviderTypeResolve struct {
	Catalog *schema.Catalog
}

func (h *ProviderTypeResolve) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req types.ProviderTypeResolveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}
	resp, err := h.Catalog.ResolveType(r.Context(), req.ProviderSource, req.ProviderVersion, req.Type)
	if err != nil {
		writeSchemaError(w, r, err)
		return
	}
	respond.JSON(w, http.StatusOK, resp)
}

type ProviderTypeSchema struct {
	Catalog *schema.Catalog
}

func (h *ProviderTypeSchema) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req types.ProviderTypeSchemaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}
	schema, err := h.Catalog.ReadTypeSchema(r.Context(), req.ProviderSource, req.ProviderVersion, req.Kind, req.Type)
	if err != nil {
		writeSchemaError(w, r, err)
		return
	}
	respond.JSON(w, http.StatusOK, types.ProviderTypeSchemaResponse{
		Type:   req.Type,
		Kind:   req.Kind,
		Schema: schema,
	})
}

type ProviderTypeIdentity struct {
	Catalog *schema.Catalog
}

func (h *ProviderTypeIdentity) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req types.ProviderTypeIdentityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}
	identity, err := h.Catalog.IdentitySchema(r.Context(), req.ProviderSource, req.ProviderVersion, req.Type)
	if err != nil {
		writeSchemaError(w, r, err)
		return
	}
	respond.JSON(w, http.StatusOK, types.ProviderTypeIdentityResponse{
		Type:     req.Type,
		Identity: identity,
	})
}

type ProviderConfigSchema struct {
	Catalog *schema.Catalog
}

func (h *ProviderConfigSchema) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req types.ProviderConfigSchemaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}
	schema, err := h.Catalog.ReadProviderSchema(r.Context(), req.ProviderSource, req.ProviderVersion)
	if err != nil {
		writeSchemaError(w, r, err)
		return
	}
	respond.JSON(w, http.StatusOK, types.ProviderConfigSchemaResponse{Schema: schema})
}
