import type { Command } from "commander";
import { findCommandSpec } from "@opsy/contracts";
import { getApiUrl, getToken } from "../config";
import { apiRequest } from "../client";

export type GlobalFlags = {
  token?: string;
  apiUrl?: string;
  json?: boolean;
  quiet?: boolean;
};

export type CliDeps = {
  apiRequest: typeof apiRequest;
  getToken: typeof getToken;
  getApiUrl: typeof getApiUrl;
  log: (message?: string) => void;
  error: (message?: string) => void;
  exit: (code: number) => never;
};

export const defaultCliDeps: CliDeps = {
  apiRequest,
  getToken,
  getApiUrl,
  log: (message?: string) => console.log(message),
  error: (message?: string) => console.error(message),
  exit: (code: number) => process.exit(code),
};

export function getRootFlags(command: Command): GlobalFlags {
  let current = command;
  while (current.parent) current = current.parent;
  return current.opts<GlobalFlags>();
}

export function handleCliError(error: unknown, deps: CliDeps): never {
  deps.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  return deps.exit(1);
}

export function addSharedHelp(command: Command, path: string[]) {
  const spec = findCommandSpec(path);
  if (!spec) {
    return command;
  }
  if (spec.examples?.length || spec.notes?.length || spec.flags?.length) {
    const flags = spec.flags?.length
      ? `\nFlags:\n${spec.flags.map((flag) => {
        const value = flag.value ? ` ${flag.value}` : "";
        const required = flag.required ? " (required)" : "";
        return `  --${flag.name}${value}${required}  ${flag.description}`;
      }).join("\n")}`
      : "";
    const notes = spec.notes?.length ? `\nNotes:\n${spec.notes.map((note) => `  ${note}`).join("\n")}` : "";
    const examples = spec.examples?.length ? `\nExamples:\n${spec.examples.map((example) => `  ${example}`).join("\n")}` : "";
    command.addHelpText("after", `\n${spec.usage}${flags}${notes}${examples}`);
  }
  return command;
}

export function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
