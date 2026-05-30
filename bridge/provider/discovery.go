package provider

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Discover locates the provider binary for the given source and version under baseDir.
// The expected layout is: <baseDir>/<source>/<version>/<binary>.
// Returns the absolute executable path or an error listing available versions.
func Discover(baseDir, source, version string) (string, error) {
	versionDir := filepath.Join(baseDir, source, version)
	entries, err := os.ReadDir(versionDir)
	if err == nil {
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			info, err := e.Info()
			if err != nil {
				continue
			}
			if info.Mode()&0o111 != 0 {
				return filepath.Join(versionDir, e.Name()), nil
			}
		}
	}

	// Binary not found — list available versions for this source.
	available, listErr := listVersions(baseDir, source)
	if listErr != nil || len(available) == 0 {
		return "", fmt.Errorf("provider %q version %q not found in %q", source, version, baseDir)
	}
	return "", &ErrVersionNotFound{
		Source:            source,
		Version:           version,
		AvailableVersions: available,
	}
}

// listVersions returns all available versions for a provider source.
func listVersions(baseDir, source string) ([]string, error) {
	sourceDir := filepath.Join(baseDir, source)
	entries, err := os.ReadDir(sourceDir)
	if err != nil {
		return nil, err
	}
	var versions []string
	for _, e := range entries {
		if e.IsDir() {
			versions = append(versions, e.Name())
		}
	}
	return versions, nil
}

// defaultProviderDir returns the default provider binary directory.
func defaultProviderDir() string {
	if dir := os.Getenv("OPSY_PROVIDER_DIR"); dir != "" {
		return dir
	}
	if _, err := os.Stat("/opt/opsy/providers"); err == nil {
		return "/opt/opsy/providers"
	}
	return "./providers"
}

// ErrVersionNotFound is returned when a provider binary is not found.
type ErrVersionNotFound struct {
	Source            string
	Version           string
	AvailableVersions []string
}

func (e *ErrVersionNotFound) Error() string {
	return fmt.Sprintf("provider %q version %q not available; found: %s",
		e.Source, e.Version, strings.Join(e.AvailableVersions, ", "))
}
