package provider

import "sync"

// tailWriter is an io.Writer that keeps only the last `max` bytes. Wired to
// go-plugin's SyncStderr so that when a provider panics (the panic text hits
// stderr just before the plugin exits), we can include the tail in the error
// response — turning opaque gRPC EOFs into actionable panic traces.
type tailWriter struct {
	mu  sync.Mutex
	buf []byte
	max int
}

func newTailWriter(max int) *tailWriter {
	return &tailWriter{max: max}
}

func (t *tailWriter) Write(p []byte) (int, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.buf = append(t.buf, p...)
	if len(t.buf) > t.max {
		// Copy into a fresh slice so the discarded prefix becomes GC-able;
		// re-slicing alone would retain the full backing array across the
		// plugin's lifetime under verbose logging.
		fresh := make([]byte, t.max)
		copy(fresh, t.buf[len(t.buf)-t.max:])
		t.buf = fresh
	}
	return len(p), nil
}

func (t *tailWriter) String() string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return string(t.buf)
}
