package provider

import (
	"slices"
	"testing"
)

func TestScrubProviderEnv(t *testing.T) {
	tests := []struct {
		name string
		in   []string
		want []string
	}{
		{
			name: "strips AWS_* prefix",
			in:   []string{"AWS_ACCESS_KEY_ID=x", "AWS_SECRET_ACCESS_KEY=y", "AWS_REGION=us-east-1", "PATH=/usr/bin"},
			want: []string{"PATH=/usr/bin"},
		},
		{
			name: "strips HOME by exact match",
			in:   []string{"HOME=/root", "HOMEBREW_PREFIX=/opt/homebrew", "PATH=/usr/bin"},
			want: []string{"HOMEBREW_PREFIX=/opt/homebrew", "PATH=/usr/bin"},
		},
		{
			name: "passes through unrelated vars",
			in:   []string{"PATH=/usr/bin", "SHELL=/bin/zsh", "TF_LOG=DEBUG"},
			want: []string{"PATH=/usr/bin", "SHELL=/bin/zsh", "TF_LOG=DEBUG"},
		},
		{
			name: "tolerates entries without '='",
			in:   []string{"MALFORMED", "AWS_KEY=x", "OK=1"},
			want: []string{"MALFORMED", "OK=1"},
		},
		{
			name: "empty input yields empty output",
			in:   []string{},
			want: []string{},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := scrubProviderEnv(tc.in)
			if !slices.Equal(got, tc.want) {
				t.Errorf("scrubProviderEnv(%v) = %v, want %v", tc.in, got, tc.want)
			}
		})
	}
}
