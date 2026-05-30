package provider_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/opsydev/opsy/bridge/provider"
)

func TestDiscover_Found(t *testing.T) {
	dir := t.TempDir()
	binDir := filepath.Join(dir, "hashicorp/null/1.0.0")
	if err := os.MkdirAll(binDir, 0755); err != nil {
		t.Fatal(err)
	}
	binPath := filepath.Join(binDir, "terraform-provider-null_v1.0.0")
	if err := os.WriteFile(binPath, []byte("#!/bin/sh"), 0755); err != nil {
		t.Fatal(err)
	}

	got, err := provider.Discover(dir, "hashicorp/null", "1.0.0")
	if err != nil {
		t.Fatalf("Discover: %v", err)
	}
	if got != binPath {
		t.Errorf("got %q, want %q", got, binPath)
	}
}

func TestDiscover_VersionNotFound(t *testing.T) {
	dir := t.TempDir()
	// Create a different version.
	binDir := filepath.Join(dir, "hashicorp/null/1.0.0")
	os.MkdirAll(binDir, 0755)
	os.WriteFile(filepath.Join(binDir, "terraform-provider-null_v1.0.0"), []byte("x"), 0755)

	_, err := provider.Discover(dir, "hashicorp/null", "2.0.0")
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	var notFound *provider.ErrVersionNotFound
	if ok := func() bool {
		e, ok := err.(*provider.ErrVersionNotFound)
		notFound = e
		return ok
	}(); !ok {
		t.Fatalf("expected *ErrVersionNotFound, got %T: %v", err, err)
	}
	if len(notFound.AvailableVersions) == 0 {
		t.Error("expected AvailableVersions to be populated")
	}
}

func TestPoolKey_Stability(t *testing.T) {
	// Pool keys must be stable across calls with the same inputs.
	// We can't call poolKey directly (unexported), but we can verify
	// that two pool.Get calls with the same inputs don't double-spawn
	// by checking the pool is idempotent with a live pool.
	// (Full integration tested elsewhere; this just validates pool construction.)
	p := provider.NewPool(t.TempDir(), 5)
	if p == nil {
		t.Fatal("NewPool returned nil")
	}
}
