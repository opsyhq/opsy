package provider

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/opsydev/opsy/bridge/codec"
)

// Pool manages a bounded set of configured provider instances keyed by
// sha256(source + version + canonicalConfig). LRU eviction keeps the pool
// within maxSize.
//
// Concurrency model:
//   - p.mu protects the instances map.
//   - p.sf (singleflight) ensures that concurrent Get calls for the same
//     key share a single spawn rather than racing to create duplicates.
//     Without this, two simultaneous requests for an uncached provider
//     would both spawn, both configure, and one would silently orphan its
//     process when it lost the map write.
//
// The pool only manages configured CRUD-path instances. Runtime instances do
// not call GetProviderSchema; callers pass the selected provider config schema
// type loaded from the schema cache so ConfigureProvider can encode config.
type Pool struct {
	mu        sync.Mutex
	instances map[string]*Instance
	maxSize   int
	baseDir   string
	sf        singleflight.Group
}

// NewPool creates a new pool with the given provider binary directory and max size.
func NewPool(baseDir string, maxSize int) *Pool {
	if maxSize <= 0 {
		maxSize = 20
	}
	return &Pool{
		instances: make(map[string]*Instance),
		maxSize:   maxSize,
		baseDir:   baseDir,
	}
}

// BaseDir returns the directory the pool searches for provider binaries.
func (p *Pool) BaseDir() string {
	return p.baseDir
}

// Get returns an existing configured instance or spawns a new one.
// Concurrent calls with the same key share a single spawn via singleflight.
func (p *Pool) Get(ctx context.Context, source, version string, config json.RawMessage, providerSchemaType codec.SchemaType) (*Instance, error) {
	key, err := poolKey(source, version, config)
	if err != nil {
		return nil, fmt.Errorf("computing pool key: %w", err)
	}

	// Fast path: instance already in pool.
	p.mu.Lock()
	if inst, ok := p.instances[key]; ok && inst.isAlive() {
		inst.lastUsed = time.Now()
		p.mu.Unlock()
		return inst, nil
	} else if ok {
		// Process died — remove it so singleflight spawns a fresh one.
		delete(p.instances, key)
		go inst.pluginClient.Kill()
	}
	p.mu.Unlock()

	// Slow path: spawn, keyed so concurrent callers wait for the same result.
	result, err, _ := p.sf.Do(key, func() (any, error) {
		// Re-check under lock in case another goroutine stored one between our
		// fast-path miss and singleflight acquiring (edge case, but correct).
		p.mu.Lock()
		if inst, ok := p.instances[key]; ok && inst.isAlive() {
			inst.lastUsed = time.Now()
			p.mu.Unlock()
			return inst, nil
		}
		p.mu.Unlock()

		execPath, err := Discover(p.baseDir, source, version)
		if err != nil {
			return nil, err
		}

		// Use Background context for spawn-time RPCs (Launch, Configure).
		// These must not be tied to the triggering HTTP request — if that request
		// is canceled mid-configure, the instance would be torn down and the next
		// request would retry the entire spawn.
		spawnCtx := context.Background()
		inst, err := Launch(spawnCtx, execPath)
		if err != nil {
			return nil, fmt.Errorf("launching provider %s@%s: %w", source, version, err)
		}

		if err := inst.Configure(spawnCtx, config, providerSchemaType); err != nil {
			inst.Stop(context.Background())
			return nil, fmt.Errorf("configuring provider %s@%s: %w", source, version, err)
		}
		inst.configHash = key
		inst.lastUsed = time.Now()

		p.mu.Lock()
		defer p.mu.Unlock()
		p.evictIfNeeded()
		p.instances[key] = inst
		return inst, nil
	})
	if err != nil {
		return nil, err
	}
	return result.(*Instance), nil
}

// Shutdown gracefully stops all provider instances in parallel. Returns when
// every instance has stopped or ctx is canceled — whichever comes first. A
// wedged plugin.Kill() on one instance must not hold up the rest.
func (p *Pool) Shutdown(ctx context.Context) {
	p.mu.Lock()
	instances := make([]*Instance, 0, len(p.instances))
	for _, inst := range p.instances {
		instances = append(instances, inst)
	}
	p.instances = make(map[string]*Instance)
	p.mu.Unlock()

	done := make(chan struct{})
	var wg sync.WaitGroup
	for _, inst := range instances {
		wg.Add(1)
		go func(inst *Instance) {
			defer wg.Done()
			inst.Stop(ctx)
		}(inst)
	}
	go func() { wg.Wait(); close(done) }()

	select {
	case <-done:
	case <-ctx.Done():
	}
}

// evictIfNeeded removes the least-recently-used instance when the pool is full.
// Must be called with p.mu held.
func (p *Pool) evictIfNeeded() {
	if len(p.instances) < p.maxSize {
		return
	}
	var lruKey string
	var lruTime time.Time
	for k, inst := range p.instances {
		if lruKey == "" || inst.lastUsed.Before(lruTime) {
			lruKey = k
			lruTime = inst.lastUsed
		}
	}
	if lruKey != "" {
		evicted := p.instances[lruKey]
		delete(p.instances, lruKey)
		go evicted.Stop(context.Background())
	}
}

// poolKey computes a stable cache key from provider identity + config.
func poolKey(source, version string, config json.RawMessage) (string, error) {
	canonical, err := canonicalJSON(config)
	if err != nil {
		return "", err
	}
	h := sha256.New()
	h.Write([]byte(source))
	h.Write([]byte{0x00})
	h.Write([]byte(version))
	h.Write([]byte{0x00})
	h.Write(canonical)
	return fmt.Sprintf("%x", h.Sum(nil)), nil
}

// canonicalJSON re-encodes JSON with sorted keys and number-preserving decoding.
// Using UseNumber prevents float64 coercion (e.g. 10000000000 → 1e+10)
// which would produce different keys for equivalent configs.
func canonicalJSON(raw json.RawMessage) ([]byte, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return []byte("null"), nil
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return nil, err
	}
	return json.Marshal(v)
}
