// Package integration contains end-to-end tests that exercise the full bridge
// stack: HTTP handler → codec → go-plugin → real provider binary.
//
// The tests download terraform-provider-null automatically on first run and
// cache it under testdata/providers/. Set BRIDGE_PROVIDER_DIR to point at an
// existing directory tree instead.
//
// Run with:
//
//	go test -v -timeout 120s ./integration/
package integration

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/opsydev/opsy/bridge/provider"
	"github.com/opsydev/opsy/bridge/schema"
	"github.com/opsydev/opsy/bridge/server"
)

const (
	nullSource  = "hashicorp/null"
	nullVersion = "3.2.3"
)

// baseURL is set in TestMain after starting the in-process bridge.
var baseURL string

// TestMain downloads the null provider if needed, starts the bridge once for
// the whole test binary, and tears it down at the end.
func TestMain(m *testing.M) {
	providerDir := os.Getenv("BRIDGE_PROVIDER_DIR")
	if providerDir == "" {
		var err error
		providerDir, err = ensureNullProvider()
		if err != nil {
			fmt.Fprintf(os.Stderr, "skipping integration tests: could not obtain null provider: %v\n", err)
			os.Exit(0) // skip, not fail — useful in offline CI
		}
	}

	schemaCacheDir := filepath.Join(os.TempDir(), "opsy-bridge-schema-cache-tests")
	extractor := testSchemaExtractor(providerDir, schemaCacheDir)
	if err := extractor(context.Background(), nullSource, nullVersion); err != nil {
		fmt.Fprintf(os.Stderr, "schema cache setup: %v\n", err)
		os.Exit(1)
	}

	pool := provider.NewPool(providerDir, 5)
	catalog := schema.NewWithExtractor(providerDir, schemaCacheDir, extractor)
	srv := server.New(pool, catalog)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "listen: %v\n", err)
		os.Exit(1)
	}
	go http.Serve(ln, srv) //nolint:errcheck

	baseURL = "http://" + ln.Addr().String()
	code := m.Run()
	pool.Shutdown(context.Background())
	os.Exit(code)
}

func testSchemaExtractor(providerDir, schemaCacheDir string) schema.Extractor {
	return func(ctx context.Context, providerSource, providerVersion string) error {
		execPath, err := provider.Discover(providerDir, providerSource, providerVersion)
		if err != nil {
			return err
		}
		inst, err := provider.LaunchWithSchema(ctx, execPath)
		if err != nil {
			return err
		}
		defer inst.Stop(ctx)
		return schema.WriteCache(schemaCacheDir, providerSource, providerVersion, inst.Schema(), inst.IdentitySchemas())
	}
}

// ensureNullProvider returns a provider dir containing the null provider,
// downloading it from releases.hashicorp.com if not already present.
func ensureNullProvider() (string, error) {
	dir := filepath.Join("testdata", "providers")
	binDir := filepath.Join(dir, nullSource, nullVersion)

	// Already present?
	if entries, err := os.ReadDir(binDir); err == nil {
		for _, e := range entries {
			if !e.IsDir() {
				info, _ := e.Info()
				if info.Mode()&0o111 != 0 {
					return dir, nil
				}
			}
		}
	}

	goos, goarch := runtime.GOOS, runtime.GOARCH
	if goarch == "amd64" {
		goarch = "amd64"
	}
	zipName := fmt.Sprintf("terraform-provider-null_%s_%s_%s.zip", nullVersion, goos, goarch)
	url := fmt.Sprintf(
		"https://releases.hashicorp.com/terraform-provider-null/%s/%s",
		nullVersion, zipName,
	)

	fmt.Printf("downloading %s ...\n", url)
	resp, err := http.Get(url) //nolint:gosec
	if err != nil {
		return "", fmt.Errorf("download: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download: HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("reading response: %w", err)
	}

	zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		return "", fmt.Errorf("unzipping: %w", err)
	}

	if err := os.MkdirAll(binDir, 0o755); err != nil {
		return "", err
	}

	for _, f := range zr.File {
		if f.FileInfo().IsDir() || !strings.HasPrefix(f.Name, "terraform-provider-") {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return "", err
		}
		dest := filepath.Join(binDir, f.Name)
		out, err := os.OpenFile(dest, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
		if err != nil {
			rc.Close()
			return "", err
		}
		_, err = io.Copy(out, rc)
		rc.Close()
		out.Close()
		if err != nil {
			return "", err
		}
		fmt.Printf("extracted %s\n", dest)
	}

	return dir, nil
}

// ---- HTTP helpers ----

func post(t *testing.T, path string, body any) map[string]any {
	t.Helper()
	b, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	resp, err := http.Post(baseURL+path, "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("POST %s: %v", path, err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	if resp.StatusCode >= 400 {
		t.Fatalf("POST %s returned HTTP %d: %s", path, resp.StatusCode, raw)
	}

	var result map[string]any
	if err := json.Unmarshal(raw, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nraw: %s", err, raw)
	}
	return result
}

// providerRef returns the common provider fields for all configured-instance
// requests (read/plan/apply/import/validate/data-source-read). These still
// embed the full ProviderRef including provider_config.
func providerRef() map[string]any {
	return map[string]any{
		"provider_source":  nullSource,
		"provider_version": nullVersion,
		"provider_config":  map[string]any{},
	}
}

// schemaRef returns the minimal request body for schema cache endpoints. These
// endpoints must not require credentials; the request shape is intentionally
// narrower than ProviderRef.
func schemaRef() map[string]any {
	return map[string]any{
		"provider_source":  nullSource,
		"provider_version": nullVersion,
	}
}

// merge returns a new map with all keys from base and extra (extra wins).
func merge(base, extra map[string]any) map[string]any {
	m := make(map[string]any, len(base)+len(extra))
	for k, v := range base {
		m[k] = v
	}
	for k, v := range extra {
		m[k] = v
	}
	return m
}

// assertNoDiagErrors fails the test if any diagnostic has severity "error".
func assertNoDiagErrors(t *testing.T, resp map[string]any) {
	t.Helper()
	diags, _ := resp["diagnostics"].([]any)
	for _, d := range diags {
		dm, _ := d.(map[string]any)
		if dm["severity"] == "error" {
			t.Fatalf("unexpected error diagnostic: %v", dm)
		}
	}
}

// hasDiagError returns true if any diagnostic has severity "error".
func hasDiagError(resp map[string]any) bool {
	diags, _ := resp["diagnostics"].([]any)
	for _, d := range diags {
		dm, _ := d.(map[string]any)
		if dm["severity"] == "error" {
			return true
		}
	}
	return false
}

// diagSummaries returns all diagnostic summaries for debugging.
func diagSummaries(resp map[string]any) []string {
	var out []string
	diags, _ := resp["diagnostics"].([]any)
	for _, d := range diags {
		dm, _ := d.(map[string]any)
		out = append(out, fmt.Sprintf("[%s] %s", dm["severity"], dm["summary"]))
	}
	return out
}
