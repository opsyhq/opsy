package provider

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"

	goplugin "github.com/hashicorp/go-plugin"
	"github.com/hashicorp/terraform-plugin-go/tfprotov5"
	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	tf6server "github.com/hashicorp/terraform-plugin-go/tfprotov6/tf6server"
	"github.com/hashicorp/terraform-plugin-mux/tf5to6server"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// stderrTailBytes bounds the per-instance rolling stderr buffer. Large enough
// to hold a full Go panic + stack trace from a provider plugin.
const stderrTailBytes = 64 * 1024

const (
	// tfMagicCookieKey and tfMagicCookieValue are the handshake constants used
	// by all Terraform providers. These must match exactly.
	tfMagicCookieKey   = "TF_PLUGIN_MAGIC_COOKIE"
	tfMagicCookieValue = "d602bf8f470bc67ca7faa0386276bbdd4330efaf76d1a219cb4d6991ca9872b2"

	// baseProtocolVersion is the version we advertise in the handshake.
	// go-plugin negotiates the actual version via VersionedPlugins.
	baseProtocolVersion = 1
)

// Launch spawns the provider binary at execPath and returns a connected Instance.
// Both protocol v5 and v6 providers are supported: v5 providers are transparently
// upgraded to v6 via terraform-plugin-mux so the rest of the bridge only deals
// with tfprotov6. Runtime instances intentionally do not call GetProviderSchema;
// the short-lived schema extractor is the only path that loads the full schema.
func Launch(ctx context.Context, execPath string) (*Instance, error) {
	cmd := exec.CommandContext(context.Background(), execPath)
	cmd.Env = append(scrubProviderEnv(os.Environ()), "AWS_EC2_METADATA_DISABLED=true")

	stderr := newTailWriter(stderrTailBytes)
	client := goplugin.NewClient(&goplugin.ClientConfig{
		HandshakeConfig: goplugin.HandshakeConfig{
			ProtocolVersion:  baseProtocolVersion,
			MagicCookieKey:   tfMagicCookieKey,
			MagicCookieValue: tfMagicCookieValue,
		},
		// Use Background context — the process lifetime is managed by the pool
		// (via pluginClient.Kill), not tied to any individual request context.
		Cmd:              cmd,
		AllowedProtocols: []goplugin.Protocol{goplugin.ProtocolGRPC},
		Managed:          true,
		AutoMTLS:         true,
		// Advertise both v5 and v6. go-plugin picks the highest version the
		// provider binary also supports. Most providers still ship v5.
		// v5 uses our custom v5GRPCPlugin because tf5server.GRPCProviderPlugin
		// is server-only and returns an error from GRPCClient.
		VersionedPlugins: map[int]goplugin.PluginSet{
			5: {"provider": &v5GRPCPlugin{}},
			6: {"provider": &tf6server.GRPCProviderPlugin{}},
		},
		SyncStdout: io.Discard,
		SyncStderr: io.Discard,
		// Stderr (not SyncStderr) receives the host-side copy of the plugin's
		// stderr bytes — SyncStderr overrides the plugin's own os.Stderr view
		// across the gRPC channel and does not fire on host-side writes.
		Stderr: stderr,
	})

	rpcClient, err := client.Client()
	if err != nil {
		client.Kill()
		return nil, fmt.Errorf("connecting to provider: %w", err)
	}

	raw, err := rpcClient.Dispense("provider")
	if err != nil {
		client.Kill()
		return nil, fmt.Errorf("dispensing provider interface: %w", err)
	}

	// Resolve to a tfprotov6.ProviderServer regardless of negotiated version.
	grpcProvider, err := resolveProviderServer(ctx, raw)
	if err != nil {
		client.Kill()
		return nil, err
	}

	inst := &Instance{
		pluginClient: client,
		grpc:         grpcProvider,
		sem:          make(chan struct{}, 10),
		stderr:       stderr,
	}

	return inst, nil
}

// LaunchWithSchema is reserved for the short-lived extractor process. It
// launches a provider, calls GetProviderSchema once, stores the full response on
// the returned instance, and lets the caller serialize shards before stopping it.
func LaunchWithSchema(ctx context.Context, execPath string) (*Instance, error) {
	inst, err := Launch(ctx, execPath)
	if err != nil {
		return nil, err
	}
	schemaResult, err := inst.Call(ctx, func(grpc tfprotov6.ProviderServer) (any, error) {
		return grpc.GetProviderSchema(ctx, &tfprotov6.GetProviderSchemaRequest{})
	})
	if err != nil {
		inst.Stop(context.Background())
		return nil, fmt.Errorf("GetProviderSchema: %w", err)
	}
	inst.schema = schemaResult.(*tfprotov6.GetProviderSchemaResponse)

	// Resource identity is credential-free static data, captured here once
	// alongside the schema. A provider that does not implement the RPC
	// returns gRPC Unimplemented; that is the provider's own source-of-truth
	// signal that the type has no structured identity, so callers fall back
	// to a raw import ID. Any other error is a real provider fault and is
	// surfaced rather than silently masked.
	identityResult, err := inst.Call(ctx, func(grpc tfprotov6.ProviderServer) (any, error) {
		return grpc.GetResourceIdentitySchemas(ctx, &tfprotov6.GetResourceIdentitySchemasRequest{})
	})
	if err != nil {
		if status.Code(err) != codes.Unimplemented {
			inst.Stop(context.Background())
			return nil, fmt.Errorf("GetResourceIdentitySchemas: %w", err)
		}
	} else {
		inst.identity = identityResult.(*tfprotov6.GetResourceIdentitySchemasResponse).IdentitySchemas
	}
	return inst, nil
}

// resolveProviderServer converts whatever go-plugin dispensed into a
// tfprotov6.ProviderServer. v6 providers pass through directly; v5 providers
// are wrapped with the protocol-upgrade shim from terraform-plugin-mux.
func resolveProviderServer(ctx context.Context, raw any) (tfprotov6.ProviderServer, error) {
	switch p := raw.(type) {
	case tfprotov6.ProviderServer:
		return p, nil

	case tfprotov5.ProviderServer:
		// Upgrade v5 → v6 so the rest of the bridge never needs to know about v5.
		// tf5to6server translates every v6 call into its v5 equivalent and back.
		v6, err := tf5to6server.UpgradeServer(ctx, func() tfprotov5.ProviderServer { return p })
		if err != nil {
			return nil, fmt.Errorf("upgrading v5 provider to v6: %w", err)
		}
		return v6, nil

	default:
		return nil, fmt.Errorf("provider returned unexpected type %T (expected tfprotov5 or tfprotov6)", raw)
	}
}
