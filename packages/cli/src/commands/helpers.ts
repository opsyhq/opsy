import { ImportTargetSchema, RunStatusEnum } from "@opsy/contracts";
import { Command } from "commander";
import { z } from "zod";
import {
  FileConfigStore,
  resolveApiUrl,
  resolveToken,
  type ConfigStore,
} from "../config.js";
import { createApiClient, type ApiClient } from "../client.js";
import { ApiError, CliError, EXIT_CODE, UsageError } from "../errors.js";
import { stringifyJson } from "../output.js";
import { getHelpText } from "../help.js";

export type InputStream = NodeJS.ReadableStream & { isTTY?: boolean };

export type CliIO = {
  stdin?: InputStream;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
};

export type RunCliOptions = CliIO & {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  configStore?: ConfigStore;
};

export type CommandContext = {
  env: NodeJS.ProcessEnv;
  fetchImpl: typeof fetch;
  store: ConfigStore;
  stdin: InputStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
};

export function buildContext(options: RunCliOptions): CommandContext {
  return {
    env: options.env ?? process.env,
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    store: options.configStore ?? new FileConfigStore(options.env ?? process.env),
    stdin: options.stdin ?? (process.stdin as InputStream),
    stdout: options.stdout ?? process.stdout,
    stderr: options.stderr ?? process.stderr,
  };
}

/** Add --json, --quiet, --token, --api-url to a leaf command. */
export function addCommonOptions(cmd: Command): Command {
  return cmd
    .option("--json", "Output as JSON")
    .option("--quiet", "Minimal output (IDs only)")
    .option("--token <pat>", "Override auth token")
    .option("--api-url <url>", "Override API URL");
}

/** Create a group command that shows help text and detects unknown subcommands. */
export function createGroupCommand(
  parent: Command,
  name: string,
  ctx: CommandContext,
): Command {
  const group = parent
    .command(name)
    .enablePositionalOptions()
    .configureHelp({ formatHelp: () => getHelpText(name) + "\n" })
    .allowExcessArguments(true)
    .action(() => {
      if (group.args.length > 0) {
        throw new UsageError(`unknown command "${name} ${group.args.join(" ")}"`);
      }
      write(ctx.stdout, getHelpText(name) + "\n");
    });
  return group;
}

export function write(stream: NodeJS.WritableStream, text: string) {
  stream.write(text);
}

export function writeSuccess(
  stream: NodeJS.WritableStream,
  opts: { json?: boolean; quiet?: boolean },
  jsonPayload: unknown,
  textPayload: string,
  quietPayload?: string,
): number {
  if (opts.json) {
    write(stream, stringifyJson(jsonPayload));
    return EXIT_CODE.OK;
  }

  if (opts.quiet) {
    if (quietPayload) {
      write(stream, `${quietPayload}\n`);
    }
    return EXIT_CODE.OK;
  }

  write(stream, `${textPayload}\n`);
  return EXIT_CODE.OK;
}

export async function createAuthedClient(
  opts: { token?: string; apiUrl?: string },
  context: CommandContext,
): Promise<ApiClient> {
  const { apiUrl, token } = await resolveAuth(opts, context);
  return createApiClient({ apiUrl, token, fetchImpl: context.fetchImpl });
}

export async function resolveAuth(
  opts: { token?: string; apiUrl?: string },
  context: CommandContext,
) {
  const config = await context.store.load();
  const token = resolveToken(config, context.env, opts.token);
  if (!token) {
    throw new CliError("No token configured. Use `opsy auth login --token <pat>` or set OPSY_TOKEN.", {
      code: "UNAUTHENTICATED",
      exitCode: EXIT_CODE.UNAUTHENTICATED,
    });
  }

  const apiUrl = resolveApiUrl(config, context.env, opts.apiUrl);
  return { token: token.value, apiUrl: apiUrl.value };
}

export async function resolveTextInput(
  opts: { [key: string]: string | boolean | undefined },
  context: CommandContext,
  options: {
    valueFlag: string;
    fileFlag?: string;
    description: string;
    allowEmpty: boolean;
  },
): Promise<string> {
  const value = await resolveOptionalTextInput(opts, context, options);
  if (value === undefined) {
    throw new UsageError(`Provide ${options.description} via --${options.valueFlag}, --${options.fileFlag ?? "file"}, or stdin.`);
  }
  if (!options.allowEmpty && value.length === 0) {
    throw new UsageError(`${options.description} cannot be empty.`);
  }
  return value;
}

export async function resolveOptionalTextInput(
  opts: { [key: string]: string | boolean | undefined },
  context: CommandContext,
  options: {
    valueFlag: string;
    fileFlag?: string;
    description: string;
    allowEmpty: boolean;
  },
): Promise<string | undefined> {
  const value = opts[options.valueFlag] as string | undefined;
  const fileFlag = options.fileFlag ?? "file";
  const file = opts[fileFlag] as string | undefined;
  const hasStdin = hasReadableStdin(context.stdin);

  if (value !== undefined && file !== undefined) {
    throw new UsageError(`Use either --${options.valueFlag} or --${fileFlag} for ${options.description}, not both.`);
  }
  if ((value !== undefined || file !== undefined) && hasStdin && file !== "-") {
    throw new UsageError(`${options.description} was provided both explicitly and via stdin. Use only one input source.`);
  }

  if (value !== undefined) {
    return value;
  }

  if (file !== undefined || hasStdin) {
    const text = await readInputSource(context, file);
    if (!options.allowEmpty && text.length === 0) {
      throw new UsageError(`${options.description} cannot be empty.`);
    }
    return text;
  }

  return undefined;
}

export async function readInputSource(context: CommandContext, file?: string): Promise<string> {
  if (file && file !== "-") {
    const { readFile } = await import("node:fs/promises");
    return readFile(file, "utf8");
  }

  if (!hasReadableStdin(context.stdin)) {
    throw new UsageError("No stdin input available.");
  }

  return readStream(context.stdin);
}

export async function readStream(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function hasReadableStdin(stream: InputStream): boolean {
  if (stream === process.stdin) {
    return stream.isTTY === false;
  }
  return stream.isTTY !== true;
}

export async function resolveDraftShortId(
  client: ApiClient,
  workspace: string,
  stack: string,
  providedDraftShortId?: string,
): Promise<string> {
  if (providedDraftShortId) {
    return providedDraftShortId;
  }

  const drafts = await client.listDrafts(workspace, stack);
  if (drafts.length > 0) {
    return drafts[0].shortId;
  }

  const created = await client.createDraft(workspace, stack);
  return created.shortId;
}

export async function writeDraftWithScope(
  client: ApiClient,
  opts: { workspace?: string; stack?: string },
  yaml: string,
) {
  const workspace = requireOpt(opts.workspace, "workspace", "draft write");
  const stack = requireOpt(opts.stack, "stack", "draft write");
  const draftShortId = await resolveDraftShortId(client, workspace, stack);
  return client.writeScopedDraft(workspace, stack, draftShortId, yaml);
}

export async function editDraftWithScope(
  client: ApiClient,
  opts: { workspace?: string; stack?: string },
  oldString: string,
  newString: string,
) {
  const workspace = requireOpt(opts.workspace, "workspace", "draft edit");
  const stack = requireOpt(opts.stack, "stack", "draft edit");
  const draftShortId = await resolveDraftShortId(client, workspace, stack);
  return client.editScopedDraft(workspace, stack, draftShortId, oldString, newString);
}

const ImportPayloadSchema = z.union([
  z.array(ImportTargetSchema).min(1),
  z.object({
    envSlug: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
    targets: z.array(ImportTargetSchema).min(1),
  }),
]);

export async function resolveImportPayload(
  opts: { targets?: string; file?: string },
  context: CommandContext,
): Promise<{
  envSlug?: string;
  reason?: string;
  targets: Array<{ type: string; name: string; id: string }>;
}> {
  const inline = opts.targets;
  const file = opts.file;
  const hasStdin = hasReadableStdin(context.stdin);

  const sources = [inline !== undefined, file !== undefined, hasStdin].filter(Boolean).length;
  if (sources === 0) {
    throw new UsageError("run import requires --targets, --file, or stdin.", { command: "run import" });
  }
  if (inline !== undefined && file !== undefined) {
    throw new UsageError("Use either --targets or --file for run import, not both.", { command: "run import" });
  }
  if ((inline !== undefined || file !== undefined) && hasStdin && file !== "-") {
    throw new UsageError("run import received both explicit input and stdin. Use only one payload source.", { command: "run import" });
  }

  const raw = inline ?? await readInputSource(context, file);
  return parseImportPayload(raw);
}

export function parseImportPayload(raw: string): {
  envSlug?: string;
  reason?: string;
  targets: Array<{ type: string; name: string; id: string }>;
} {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    throw new UsageError(`Import payload must be valid JSON: ${error instanceof Error ? error.message : "parse failed"}`, { command: "run import" });
  }

  const parsed = ImportPayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new UsageError("Import payload must be either a JSON array of targets or an object with { envSlug?, reason?, targets }.", { command: "run import" });
  }

  if (Array.isArray(parsed.data)) {
    return { targets: parsed.data };
  }

  return parsed.data;
}

export async function clearOrgNotesIfPresent(client: ApiClient) {
  try {
    await client.deleteOrgNotes();
  } catch (error) {
    if (!(error instanceof ApiError) || error.apiCode !== "NOT_FOUND") {
      throw error;
    }
  }
}

export function parsePositiveInt(value: string, label: string, command?: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new UsageError(`${label} must be a positive integer.`, command ? { command } : undefined);
  }
  return parsed;
}

export function validateRunStatusFlag(name: string, value: string, command?: string) {
  const parsed = RunStatusEnum.safeParse(value);
  if (!parsed.success) {
    throw new UsageError(`--${name} must be one of: ${RunStatusEnum.options.join(", ")}`, command ? { command } : undefined);
  }
}

export function requireOpt(value: string | undefined, name: string, command: string): string {
  if (!value) {
    throw new UsageError(`${command} requires --${name}.`, { command });
  }
  return value;
}
