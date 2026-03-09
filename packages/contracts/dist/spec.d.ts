export type ParsedStackYaml = {
    imports?: Record<string, string>;
    resources: Record<string, {
        type: string;
        properties: Record<string, unknown>;
    }>;
    outputs?: Record<string, string>;
    /** Passthrough keys — everything else from the spec (variables, config, etc.) */
    [key: string]: unknown;
};
export declare const EMPTY_SPEC_YAML = "resources: {}\n";
/**
 * Parses and lightly validates the Opsy YAML spec.
 * Returns the parsed object; throws on invalid YAML or missing `resources`.
 */
export declare function parseStackYaml(raw: string): ParsedStackYaml;
/**
 * Extracts the stack slugs this spec depends on via its `imports:` block.
 * Format: "stacks.<slug>.<outputKey>" → returns "<slug>"
 */
export declare function getStackDependencies(yaml: string): string[];
/**
 * Detects import cycles in the cross-stack dependency graph using DFS.
 * Returns the cycle path (e.g. ["a", "b", "c", "a"]) if a cycle exists, null otherwise.
 *
 * @param submittingSlug - the stack being submitted
 * @param submittingSpec - the new spec YAML for that stack
 * @param otherSpecs - map of slug → spec YAML for all other stacks in the workspace
 */
export declare function detectImportCycle(submittingSlug: string, submittingSpec: string, otherSpecs: Map<string, string>): string[] | null;
/**
 * Computes a deterministic SHA-256 hash of the spec.
 * Parses to JS object then canonical-JSON stringifies for ordering-independent equivalence.
 */
export declare function computeSpecHash(yaml: string): string;
//# sourceMappingURL=spec.d.ts.map