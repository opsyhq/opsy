package respond

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	"github.com/hashicorp/terraform-plugin-go/tftypes"
	"github.com/opsydev/opsy/bridge/types"
)

// JSON writes v as JSON with the given status code.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Error writes a transport-level error response (HTTP 4xx/5xx).
func Error(w http.ResponseWriter, status int, msg, detail string) {
	JSON(w, status, types.ErrorResponse{Error: msg, Detail: detail})
}

// VersionNotFoundError writes a 400 listing available versions.
func VersionNotFoundError(w http.ResponseWriter, msg string, versions []string) {
	JSON(w, http.StatusBadRequest, types.ErrorResponse{
		Error:             "provider version not available",
		Detail:            msg,
		AvailableVersions: versions,
	})
}

// ConvertDiagnostics converts tfprotov6.Diagnostic slice to the HTTP response type.
func ConvertDiagnostics(diags []*tfprotov6.Diagnostic) []types.Diagnostic {
	if len(diags) == 0 {
		return nil
	}
	out := make([]types.Diagnostic, 0, len(diags))
	for _, d := range diags {
		if d == nil {
			continue
		}
		td := types.Diagnostic{
			Summary: d.Summary,
			Detail:  d.Detail,
		}
		switch d.Severity {
		case tfprotov6.DiagnosticSeverityError:
			td.Severity = "error"
		case tfprotov6.DiagnosticSeverityWarning:
			td.Severity = "warning"
		default:
			td.Severity = "invalid"
		}
		if d.Attribute != nil {
			td.Attribute = attributePathToStrings(d.Attribute)
		}
		out = append(out, td)
	}
	return out
}

// attributePathToStrings converts a tftypes.AttributePath to a string slice.
func attributePathToStrings(path *tftypes.AttributePath) []string {
	if path == nil {
		return nil
	}
	var parts []string
	for _, step := range path.Steps() {
		switch s := step.(type) {
		case tftypes.AttributeName:
			parts = append(parts, string(s))
		case tftypes.ElementKeyString:
			parts = append(parts, string(s))
		case tftypes.ElementKeyInt:
			parts = append(parts, fmt.Sprintf("%d", int64(s)))
		case tftypes.ElementKeyValue:
			parts = append(parts, fmt.Sprintf("%v", tftypes.Value(s)))
		}
	}
	return parts
}

// ConvertAttributePaths converts requires_replace paths to [][]string.
func ConvertAttributePaths(paths []*tftypes.AttributePath) [][]string {
	if len(paths) == 0 {
		return nil
	}
	out := make([][]string, 0, len(paths))
	for _, p := range paths {
		if parts := attributePathToStrings(p); len(parts) > 0 {
			out = append(out, parts)
		}
	}
	return out
}
