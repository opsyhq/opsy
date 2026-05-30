package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	"github.com/opsydev/opsy/bridge/codec"
)

const stopProviderGrace = 2 * time.Second

type pluginLifecycle interface {
	Exited() bool
	Kill()
}

// Instance wraps a running provider subprocess with its gRPC client.
type Instance struct {
	pluginClient pluginLifecycle
	grpc         tfprotov6.ProviderServer
	schema       *tfprotov6.GetProviderSchemaResponse                // populated only by LaunchWithSchema for the extractor
	identity     map[string]*tfprotov6.ResourceIdentitySchema        // populated only by LaunchWithSchema for the extractor
	configHash   string
	lastUsed     time.Time
	sem          chan struct{} // bounded-concurrency channel; cancel-aware
	stderr       *tailWriter   // rolling tail of plugin stderr for panic surfacing
	stopOnce     sync.Once
}

// Call bounds concurrent gRPC calls into the provider. All provider interactions
// must go through this method; the semaphore caps in-flight calls at the channel
// capacity. The cap matches Terraform CLI's default -parallelism, which is the
// empirically-safe ceiling across the provider ecosystem. Lock acquisition is
// context-aware: if ctx is canceled while waiting, Call returns immediately
// with ctx.Err().
func (inst *Instance) Call(ctx context.Context, fn func(tfprotov6.ProviderServer) (any, error)) (any, error) {
	select {
	case inst.sem <- struct{}{}:
		defer func() { <-inst.sem }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	inst.lastUsed = time.Now()
	return fn(inst.grpc)
}

// Schema returns the full provider schema captured only by LaunchWithSchema.
func (inst *Instance) Schema() *tfprotov6.GetProviderSchemaResponse {
	return inst.schema
}

// IdentitySchemas returns the resource identity schemas captured only by
// LaunchWithSchema. Nil when the provider does not implement the RPC.
func (inst *Instance) IdentitySchemas() map[string]*tfprotov6.ResourceIdentitySchema {
	return inst.identity
}

// Configure calls ConfigureProvider on the provider with the given JSON config.
func (inst *Instance) Configure(ctx context.Context, providerConfig json.RawMessage, schemaType codec.SchemaType) error {
	configVal, err := codec.JSONToDynamicValue(providerConfig, schemaType)
	if err != nil {
		return fmt.Errorf("encoding provider config: %w", err)
	}

	result, err := inst.Call(ctx, func(grpc tfprotov6.ProviderServer) (any, error) {
		return grpc.ConfigureProvider(ctx, &tfprotov6.ConfigureProviderRequest{
			Config: configVal,
		})
	})
	if err != nil {
		return fmt.Errorf("ConfigureProvider RPC: %w", err)
	}

	resp := result.(*tfprotov6.ConfigureProviderResponse)
	if diags := FatalDiags(resp.Diagnostics); len(diags) > 0 {
		return &DiagnosticsError{Diagnostics: diags}
	}
	return nil
}

// Stop shuts down the provider subprocess gracefully then kills it.
func (inst *Instance) Stop(ctx context.Context) {
	inst.stopOnce.Do(func() {
		stopCtx, cancel := context.WithTimeout(ctx, stopProviderGrace)
		defer cancel()

		done := make(chan struct{})
		go func() {
			defer close(done)
			_, _ = inst.Call(stopCtx, func(grpc tfprotov6.ProviderServer) (any, error) {
				return grpc.StopProvider(stopCtx, &tfprotov6.StopProviderRequest{})
			})
		}()

		select {
		case <-done:
		case <-stopCtx.Done():
		}
		inst.pluginClient.Kill()
	})
}

// isAlive returns false if the plugin process has exited.
func (inst *Instance) isAlive() bool {
	return !inst.pluginClient.Exited()
}

func (inst *Instance) PluginExited() bool {
	return inst.pluginClient.Exited()
}

// StderrTail returns the rolling tail of plugin stderr.
//
// When the plugin has exited, blocks briefly to drain the scanner: go-plugin
// sets its exited flag before the stderr scanner finishes reading to EOF, so
// a plain tail read misses the final bytes where the panic trace lives.
// Kill() is idempotent on an exited plugin and its terminal <-doneLogging
// wait is the only drain primitive go-plugin exposes.
func (inst *Instance) StderrTail() string {
	if inst.pluginClient.Exited() {
		inst.pluginClient.Kill()
	}
	return inst.stderr.String()
}

// FatalDiags filters diagnostics to only error-severity entries.
func FatalDiags(diags []*tfprotov6.Diagnostic) []*tfprotov6.Diagnostic {
	var out []*tfprotov6.Diagnostic
	for _, d := range diags {
		if d.Severity == tfprotov6.DiagnosticSeverityError {
			out = append(out, d)
		}
	}
	return out
}

// DiagnosticsError wraps provider diagnostics as a Go error.
type DiagnosticsError struct {
	Diagnostics []*tfprotov6.Diagnostic
}

func (e *DiagnosticsError) Error() string {
	if len(e.Diagnostics) == 0 {
		return "provider returned error diagnostics"
	}
	d := e.Diagnostics[0]
	if d.Detail != "" {
		return fmt.Sprintf("%s: %s", d.Summary, d.Detail)
	}
	return d.Summary
}
