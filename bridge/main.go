package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"github.com/opsydev/opsy/bridge/provider"
	"github.com/opsydev/opsy/bridge/schema"
	"github.com/opsydev/opsy/bridge/server"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "schema-extract" {
		if err := runSchemaExtract(os.Args[2:]); err != nil {
			slog.Error("schema extraction failed", "error", err)
			os.Exit(1)
		}
		return
	}

	providerDir := flag.String("provider-dir", defaultProviderDir(), "directory containing provider binaries")
	schemaCacheDir := flag.String("schema-cache-dir", defaultSchemaCacheDir(), "directory containing provider schema shards")
	poolSize := flag.Int("pool-size", 20, "maximum number of concurrent provider instances")
	flag.Parse()

	pool := provider.NewPool(*providerDir, *poolSize)
	extractorPath, err := os.Executable()
	if err != nil {
		slog.Error("failed to resolve bridge executable", "error", err)
		os.Exit(1)
	}
	catalog := schema.New(*providerDir, *schemaCacheDir, extractorPath)
	srv := server.New(pool, catalog)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		slog.Error("failed to bind listener", "error", err)
		os.Exit(1)
	}
	port := listener.Addr().(*net.TCPAddr).Port

	// The control plane reads the port from stdout to locate the bridge.
	fmt.Println(port)

	// ppid-poll is the portable fallback for SIGKILL'd parents (no
	// PR_SET_PDEATHSIG on darwin).
	ctx, cancel := context.WithCancel(context.Background())
	var shutdownOnce sync.Once
	shutdown := func(reason string) {
		shutdownOnce.Do(func() {
			slog.Info("shutting down", "reason", reason)
			// Hard backstop: if pool.Shutdown or Kill wedges on a stuck plugin
			// scanner, guarantee the process exits. By the time we reach here
			// the parent is already gone (or has asked us to stop), so any
			// in-flight apply has nowhere to return anyway — and the 3s
			// pool.Shutdown deadline below has already SIGKILL'd its plugin.
			go func() {
				time.Sleep(10 * time.Second)
				slog.Warn("shutdown backstop firing", "reason", reason)
				os.Exit(0)
			}()
			cancel()
			// inst.Stop → inst.Call blocks on the per-instance semaphore; an
			// in-flight apply under WithoutCancel holds it up to 10 min. The
			// deadline lets ctx.Err() unblock the wait so Stop falls through
			// to pluginClient.Kill(), rather than orphaning the bridge.
			shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 3*time.Second)
			pool.Shutdown(shutdownCtx)
			cancelShutdown()
			_ = listener.Close()
		})
	}
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGTERM, syscall.SIGINT)
		<-sig
		shutdown("signal")
	}()
	go func() {
		parent := os.Getppid()
		tick := time.NewTicker(2 * time.Second)
		defer tick.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-tick.C:
				if os.Getppid() != parent {
					shutdown("parent exited")
					return
				}
			}
		}
	}()

	slog.Info("bridge started", "port", port, "provider_dir", *providerDir, "schema_cache_dir", *schemaCacheDir)
	if err := http.Serve(listener, srv); err != nil && ctx.Err() == nil {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}
}

func runSchemaExtract(args []string) error {
	fs := flag.NewFlagSet("schema-extract", flag.ContinueOnError)
	providerDir := fs.String("provider-dir", defaultProviderDir(), "directory containing provider binaries")
	schemaCacheDir := fs.String("schema-cache-dir", defaultSchemaCacheDir(), "directory containing provider schema shards")
	providerSource := fs.String("provider-source", "", "Terraform provider source, for example hashicorp/aws")
	providerVersion := fs.String("provider-version", "", "Terraform provider version")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *providerSource == "" {
		return fmt.Errorf("--provider-source is required")
	}
	if *providerVersion == "" {
		return fmt.Errorf("--provider-version is required")
	}

	execPath, err := provider.Discover(*providerDir, *providerSource, *providerVersion)
	if err != nil {
		return err
	}

	ctx := context.Background()
	inst, err := provider.LaunchWithSchema(ctx, execPath)
	if err != nil {
		return err
	}
	defer inst.Stop(ctx)
	return schema.WriteCache(*schemaCacheDir, *providerSource, *providerVersion, inst.Schema(), inst.IdentitySchemas())
}

func defaultProviderDir() string {
	if dir := os.Getenv("OPSY_PROVIDER_DIR"); dir != "" {
		return dir
	}
	if _, err := os.Stat("/opt/opsy/providers"); err == nil {
		return "/opt/opsy/providers"
	}
	return "./providers"
}

func defaultSchemaCacheDir() string {
	if dir := os.Getenv("OPSY_SCHEMA_CACHE_DIR"); dir != "" {
		return dir
	}
	return filepath.Join(os.TempDir(), "opsy-schema-cache")
}
