package provider

import "strings"

// Without this, the AWS SDK inside the provider picks up ambient AWS_* vars,
// HOME lets it read ~/.aws/credentials, and IMDS fallback reaches the host
// role — an integration with empty credentials silently authenticates as
// whoever the bridge host can.
var subprocessEnvScrubPrefixes = []string{"AWS_"}
var subprocessEnvScrubExact = []string{"HOME"}

func scrubProviderEnv(env []string) []string {
	out := make([]string, 0, len(env))
	for _, kv := range env {
		if !shouldScrub(kv) {
			out = append(out, kv)
		}
	}
	return out
}

func shouldScrub(kv string) bool {
	eq := strings.IndexByte(kv, '=')
	if eq < 0 {
		return false
	}
	key := kv[:eq]
	for _, p := range subprocessEnvScrubPrefixes {
		if strings.HasPrefix(key, p) {
			return true
		}
	}
	for _, k := range subprocessEnvScrubExact {
		if key == k {
			return true
		}
	}
	return false
}
