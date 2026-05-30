package provider

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
)

type fakePluginLifecycle struct {
	killCalls atomic.Int32
}

func (f *fakePluginLifecycle) Exited() bool {
	return false
}

func (f *fakePluginLifecycle) Kill() {
	f.killCalls.Add(1)
}

type blockingStopProvider struct {
	tfprotov6.ProviderServer
	release chan struct{}
	started chan struct{}
}

func (p *blockingStopProvider) StopProvider(context.Context, *tfprotov6.StopProviderRequest) (*tfprotov6.StopProviderResponse, error) {
	select {
	case <-p.started:
	default:
		close(p.started)
	}
	<-p.release
	return &tfprotov6.StopProviderResponse{}, nil
}

func TestInstanceStopKillsAfterContextDeadlineAndIsIdempotent(t *testing.T) {
	plugin := &fakePluginLifecycle{}
	provider := &blockingStopProvider{
		release: make(chan struct{}),
		started: make(chan struct{}),
	}
	inst := &Instance{
		pluginClient: plugin,
		grpc:         provider,
		sem:          make(chan struct{}, 1),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	done := make(chan struct{})
	go func() {
		defer close(done)
		inst.Stop(ctx)
	}()

	select {
	case <-provider.started:
	case <-time.After(100 * time.Millisecond):
		t.Fatal("StopProvider was not called before Kill")
	}

	select {
	case <-done:
	case <-time.After(200 * time.Millisecond):
		t.Fatal("Stop did not return after context deadline")
	}
	close(provider.release)
	inst.Stop(context.Background())
	if got := plugin.killCalls.Load(); got != 1 {
		t.Fatalf("Kill calls = %d, want 1", got)
	}
}
