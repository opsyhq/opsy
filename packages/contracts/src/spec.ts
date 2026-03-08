import { createHash } from "node:crypto";
import { parse as parseYaml } from "yaml";
import { canonicalJsonStringify } from "./common.js";

export type ParsedStackYaml = {
  imports?: Record<string, string>;
  resources: Record<string, { type: string; properties: Record<string, unknown> }>;
  outputs?: Record<string, string>;
  /** Passthrough keys — everything else from the spec (variables, config, etc.) */
  [key: string]: unknown;
};

export const EMPTY_SPEC_YAML = "resources: {}\n";

/**
 * Parses and lightly validates the Opsy YAML spec.
 * Returns the parsed object; throws on invalid YAML or missing `resources`.
 */
export function parseStackYaml(raw: string): ParsedStackYaml {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("Spec must be a non-empty YAML string.");
  }

  let obj: unknown;
  try {
    obj = parseYaml(raw);
  } catch (err: any) {
    throw new Error(`Invalid YAML: ${err?.message ?? "parse error"}`);
  }

  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("Spec must be a YAML mapping (object).");
  }

  const doc = obj as Record<string, unknown>;

  if (!("resources" in doc) || typeof doc.resources !== "object" || Array.isArray(doc.resources)) {
    throw new Error('Spec must have a "resources" mapping.');
  }

  return doc as ParsedStackYaml;
}

/**
 * Extracts the stack slugs this spec depends on via its `imports:` block.
 * Format: "stacks.<slug>.<outputKey>" → returns "<slug>"
 */
export function getStackDependencies(yaml: string): string[] {
  try {
    const parsed = parseStackYaml(yaml);
    const slugs = new Set<string>();
    for (const source of Object.values(parsed.imports ?? {})) {
      if (!(source as string).startsWith("stacks.")) continue;
      const slug = (source as string).split(".")[1];
      if (slug) slugs.add(slug);
    }
    return [...slugs].sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/**
 * Detects import cycles in the cross-stack dependency graph using DFS.
 * Returns the cycle path (e.g. ["a", "b", "c", "a"]) if a cycle exists, null otherwise.
 *
 * @param submittingSlug - the stack being submitted
 * @param submittingSpec - the new spec YAML for that stack
 * @param otherSpecs - map of slug → spec YAML for all other stacks in the workspace
 */
export function detectImportCycle(
  submittingSlug: string,
  submittingSpec: string,
  otherSpecs: Map<string, string>,
): string[] | null {
  const adjacency = new Map<string, string[]>();
  adjacency.set(submittingSlug, getStackDependencies(submittingSpec));
  for (const [slug, yaml] of otherSpecs) {
    adjacency.set(slug, getStackDependencies(yaml));
  }

  const inStack = new Set<string>();
  const done = new Set<string>();

  function dfs(slug: string, path: string[]): string[] | null {
    if (inStack.has(slug)) {
      const cycleStart = path.indexOf(slug);
      return [...path.slice(cycleStart), slug];
    }
    if (done.has(slug)) return null;

    inStack.add(slug);
    path.push(slug);

    for (const dep of adjacency.get(slug) ?? []) {
      const result = dfs(dep, path);
      if (result) return result;
    }

    path.pop();
    inStack.delete(slug);
    done.add(slug);
    return null;
  }

  return dfs(submittingSlug, []);
}

/**
 * Computes a deterministic SHA-256 hash of the spec.
 * Parses to JS object then canonical-JSON stringifies for ordering-independent equivalence.
 */
export function computeSpecHash(yaml: string): string {
  let obj: unknown;
  try {
    obj = parseYaml(yaml);
  } catch {
    obj = yaml;
  }
  const canonical = canonicalJsonStringify(obj as any);
  return createHash("sha256").update(canonical).digest("hex");
}
