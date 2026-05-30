package provider

import (
	"context"

	goplugin "github.com/hashicorp/go-plugin"
	"github.com/opsydev/opsy/bridge/internal/tfplugin5"
	"google.golang.org/grpc"
)

// v5GRPCPlugin is a goplugin.GRPCPlugin that returns a working v5 provider client.
// It replaces tf5server.GRPCProviderPlugin which only implements the server side
// and returns an error from GRPCClient.
type v5GRPCPlugin struct {
	goplugin.Plugin
}

func (p *v5GRPCPlugin) GRPCServer(_ *goplugin.GRPCBroker, _ *grpc.Server) error {
	return nil // client-only — we never serve
}

func (p *v5GRPCPlugin) GRPCClient(_ context.Context, _ *goplugin.GRPCBroker, conn *grpc.ClientConn) (interface{}, error) {
	return &v5Adapter{client: tfplugin5.NewProviderClient(conn)}, nil
}
