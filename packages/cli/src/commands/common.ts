import type { Command } from "commander";
import { findCommandSpec, renderCommandErrorMessage } from "@opsy/contracts";
import { ApiRequestError, apiStream } from "../client";
import { getApiUrl, getProject, getToken } from "../config";
import { apiRequest } from "../client";

export type GlobalFlags = {
  token?: string;
  apiUrl?: string;
  project?: string;
  json?: boolean;
  quiet?: boolean;
};

export type CliDeps = {
  apiRequest: typeof apiRequest;
  apiStream: typeof apiStream;
  getToken: typeof getToken;
  getApiUrl: typeof getApiUrl;
  log: (message?: string) => void;
  error: (message?: string) => void;
  exit: (code: number) => never;
};

export const defaultCliDeps: CliDeps = {
  apiRequest,
  apiStream,
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
  let message = error instanceof Error ? error.message : String(error);
  if (error instanceof ApiRequestError) {
    message = error.code ? `${error.code}: ${error.message}` : error.message;
  }
  deps.error(`Error: ${renderCommandErrorMessage(message)}`);
  return deps.exit(1);
}

export function requireOptionValue(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing --${name}.`);
  }
  return value;
}

export function requireArgumentValue(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing ${label}.`);
  }
  return value;
}

export function parseJsonFlag<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`Invalid JSON in --${label}.`);
  }
}

export function resolveProjectValue(command: Command, value?: string): string | undefined {
  const rootFlags = getRootFlags(command);
  return getProject({
    project: value ?? rootFlags.project,
  });
}

export function requireProjectValue(command: Command, value?: string): string {
  return requireOptionValue(resolveProjectValue(command, value), "project");
}

export function addSharedHelp(command: Command, path: string[]) {
  const spec = findCommandSpec(path);
  if (!spec) {
    return command;
  }
  const usageTail = spec.usage.split(" ").slice(path.length + 1).join(" ");
  if (usageTail) {
    command.usage(usageTail);
  }
  if (spec.examples?.length || spec.notes?.length || spec.flags?.length || spec.whenToUse?.length || spec.nextSteps?.length) {
    const flags = spec.flags?.length
      ? `\nFlags:\n${spec.flags.map((flag) => {
        const value = flag.value ? ` ${flag.value}` : "";
        const required = flag.required ? " (required)" : "";
        return `  --${flag.name}${value}${required}  ${flag.description}`;
      }).join("\n")}`
      : "";
    const whenToUse = spec.whenToUse?.length ? `\nWhen to use:\n${spec.whenToUse.map((line) => `  ${line}`).join("\n")}` : "";
    const notes = spec.notes?.length ? `\nNotes:\n${spec.notes.map((note) => `  ${note}`).join("\n")}` : "";
    const examples = spec.examples?.length ? `\nExamples:\n${spec.examples.map((example) => `  ${example}`).join("\n")}` : "";
    const nextSteps = spec.nextSteps?.length ? `\nWhat to do next:\n${spec.nextSteps.map((line) => `  ${line}`).join("\n")}` : "";
    command.addHelpText("after", `\nUsage:\n  ${spec.usage}${flags}${whenToUse}${examples}${notes}${nextSteps}`);
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
