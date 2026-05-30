package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	"github.com/hashicorp/terraform-plugin-go/tftypes"
	"github.com/opsydev/opsy/bridge/codec"
	"github.com/opsydev/opsy/bridge/provider"
	"github.com/opsydev/opsy/bridge/respond"
	"github.com/opsydev/opsy/bridge/schema"
	"github.com/opsydev/opsy/bridge/types"
)

// ResourceImport handles POST /resources/import.
// Calls ImportResourceState then ReadResource to get the full live state.
type ResourceImport struct {
	Pool    *provider.Pool
	Catalog *schema.Catalog
}

func (h *ResourceImport) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req types.ResourceImportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	if _, err := resourceSchemaType(r.Context(), h.Catalog, req.ProviderRef, req.Type); err != nil {
		writeSchemaError(w, r, err)
		return
	}

	// ID and Identity are mutually exclusive on the Terraform RPC. Resolve the
	// structured-identity branch here — credential-free, from the cached
	// identity schema — so bad input fails fast before a provider is launched.
	importReq := &tfprotov6.ImportResourceStateRequest{TypeName: req.Type}
	switch {
	case len(req.Identity) > 0:
		idSchema, err := h.Catalog.IdentitySchema(r.Context(), req.ProviderSource, req.ProviderVersion, req.Type)
		if err != nil {
			writeSchemaError(w, r, err)
			return
		}
		if idSchema == nil {
			respond.Error(w, http.StatusBadRequest, "no import identity",
				fmt.Sprintf("resource %q advertises no structured import identity; use a raw import ID", req.Type))
			return
		}
		// Deserialization boundary: the cached identity schema stores each
		// attribute's wire type as a library-owned JSON signature (same as
		// (*Attribute).ToTF). codec coerces the user strings and rejects
		// unknown attributes; a missing required attribute is left to the
		// provider, which owns that check.
		attrTypes := make(map[string]tftypes.Type, len(idSchema.Attributes))
		for _, attr := range idSchema.Attributes {
			t, err := tftypes.ParseJSONType(attr.Type)
			if err != nil {
				respond.Error(w, http.StatusBadRequest, "invalid import identity",
					fmt.Sprintf("identity attribute %q has an unusable type signature: %s", attr.Name, err))
				return
			}
			attrTypes[attr.Name] = t
		}
		dv, err := codec.IdentityDynamicValue(attrTypes, req.Identity)
		if err != nil {
			respond.Error(w, http.StatusBadRequest, "invalid import identity", err.Error())
			return
		}
		importReq.Identity = &tfprotov6.ResourceIdentityData{IdentityData: dv}
	case req.ProviderID != "":
		importReq.ID = req.ProviderID
	default:
		respond.Error(w, http.StatusBadRequest, "invalid request body",
			"import requires either a provider ID or identity attributes")
		return
	}

	inst, err := resolveInstance(r.Context(), h.Pool, h.Catalog, req.ProviderRef)
	if err != nil {
		writeProviderError(w, r, nil, err)
		return
	}

	// Step 1: ImportResourceState.
	importResult, err := inst.Call(r.Context(), func(grpc tfprotov6.ProviderServer) (any, error) {
		return grpc.ImportResourceState(r.Context(), importReq)
	})
	if err != nil {
		writeProviderError(w, r, inst, err)
		return
	}
	importResp := importResult.(*tfprotov6.ImportResourceStateResponse)

	// Step 2: ReadResource for each imported resource to get live state. The
	// slice is allocated non-nil so a zero-result import (provider returned
	// only diagnostics) still serializes `imported_resources` as the empty
	// array the wire contract promises — never JSON null.
	out := make([]types.ImportedResource, 0, len(importResp.ImportedResources))
	var diags []*tfprotov6.Diagnostic
	diags = append(diags, importResp.Diagnostics...)

	for _, imported := range importResp.ImportedResources {
		typeName := imported.TypeName
		if typeName == "" {
			typeName = req.Type
		}

		schemaType, err := resourceSchemaType(r.Context(), h.Catalog, req.ProviderRef, typeName)
		if err != nil {
			writeSchemaError(w, r, err)
			return
		}

		readResult, err := inst.Call(r.Context(), func(grpc tfprotov6.ProviderServer) (any, error) {
			return grpc.ReadResource(r.Context(), &tfprotov6.ReadResourceRequest{
				TypeName:     typeName,
				CurrentState: imported.State,
				Private:      imported.Private,
			})
		})
		if err != nil {
			writeProviderError(w, r, inst, err)
			return
		}
		readResp := readResult.(*tfprotov6.ReadResourceResponse)
		diags = append(diags, readResp.Diagnostics...)

		stateJSON, err := codec.DynamicValueToJSON(readResp.NewState, schemaType.Type)
		if err != nil {
			respond.Error(w, http.StatusInternalServerError, "decoding error", err.Error())
			return
		}

		out = append(out, types.ImportedResource{
			TypeName: typeName,
			State:    stateJSON,
			Private:  readResp.Private,
		})
	}

	respond.JSON(w, http.StatusOK, types.ResourceImportResponse{
		ImportedResources: out,
		Diagnostics:       respond.ConvertDiagnostics(diags),
	})
}
