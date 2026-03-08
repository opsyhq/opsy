import { ImportTargetSchema, RunStatusEnum } from "@opsy/contracts";
import { z } from "zod";
import { getBooleanFlag, getOptionalIntFlag, getStringFlag, parseArgs, type ParsedArgs } from "./args.js";
import {
  FileConfigStore,
  resolveApiUrl,
  resolveToken,
  type CliConfig,
  type ConfigStore,
} from "./config.js";
import { createApiClient, type ApiClient } from "./client.js";
import { ApiError, CliError, EXIT_CODE, UsageError, toErrorPayload } from "./errors.js";
import {
  formatDraftCreate,
  formatDraftDetail,
  formatDraftList,
  formatDraftMutation,
  formatDraftValidate,
  formatOrgList,
  formatOrgNotes,
  formatOrgVariable,
  formatRestRun,
  formatRevisionDetail,
  formatRevisionList,
  formatRunApply,
  formatRunGet,
  formatRunImport,
  formatRunList,
  formatRunWait,
  formatWhoAmI,
  formatWorkspaceList,
  stringifyJson,
} from "./output.js";

type InputStream = NodeJS.ReadableStream & { isTTY?: boolean };

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

type CommandContext = {
  env: NodeJS.ProcessEnv;
  fetchImpl: typeof fetch;
  store: ConfigStore;
  stdin: InputStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
};

const ImportPayloadSchema = z.union([
  z.array(ImportTargetSchema).min(1),
  z.object({
    envSlug: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
    targets: z.array(ImportTargetSchema).min(1),
  }),
]);

export async function runCli(argv: string[], options: RunCliOptions = {}): Promise<number> {
  const context: CommandContext = {
    env: options.env ?? process.env,
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    store: options.configStore ?? new FileConfigStore(options.env ?? process.env),
    stdin: options.stdin ?? (process.stdin as InputStream),
    stdout: options.stdout ?? process.stdout,
    stderr: options.stderr ?? process.stderr,
  };

  try {
    if (argv.length === 0) {
      write(context.stdout, `${getHelpText()}\n`);
      return EXIT_CODE.OK;
    }

    const [group, command, ...rest] = argv;
    if (group === "--help" || group === "help") {
      write(context.stdout, `${getHelpText()}\n`);
      return EXIT_CODE.OK;
    }

    switch (`${group}:${command ?? ""}`) {
      case "auth:login":
        return await handleAuthLogin(rest, context);
      case "auth:whoami":
        return await handleAuthWhoAmI(rest, context);
      case "auth:logout":
        return await handleAuthLogout(rest, context);
      case "workspace:list":
        return await handleWorkspaceList(rest, context);
      case "draft:list":
        return await handleDraftList(rest, context);
      case "draft:get":
        return await handleDraftGet(rest, context);
      case "draft:create":
        return await handleDraftCreate(rest, context);
      case "draft:write":
        return await handleDraftWrite(rest, context);
      case "draft:edit":
        return await handleDraftEdit(rest, context);
      case "draft:validate":
        return await handleDraftValidate(rest, context);
      case "draft:delete":
        return await handleDraftDelete(rest, context);
      case "revision:list":
        return await handleRevisionList(rest, context);
      case "revision:get":
        return await handleRevisionGet(rest, context);
      case "revision:delete":
        return await handleRevisionDelete(rest, context);
      case "run:get":
        return await handleRunGet(rest, context);
      case "run:list":
        return await handleRunList(rest, context);
      case "run:apply":
        return await handleRunApply(rest, context);
      case "run:wait":
        return await handleRunWait(rest, context);
      case "run:import":
        return await handleRunImport(rest, context);
      case "run:cancel":
        return await handleRunCancel(rest, context);
      case "org:list":
        return await handleOrgList(rest, context);
      case "org:set":
        return await handleOrgSet(rest, context);
      case "org:delete":
        return await handleOrgDelete(rest, context);
      case "org:get-notes":
        return await handleOrgGetNotes(rest, context);
      case "org:set-notes":
        return await handleOrgSetNotes(rest, context);
      default:
        throw new UsageError(`Unknown command: ${[group, command].filter(Boolean).join(" ")}`);
    }
  } catch (error) {
    const payload = toErrorPayload(error);
    const asJson = argv.includes("--json");

    if (asJson) {
      write(context.stderr, stringifyJson(payload));
    } else if (error instanceof UsageError) {
      write(context.stderr, `${error.message}\n\n${getHelpText()}\n`);
    } else if (error instanceof CliError) {
      write(context.stderr, `${error.message}\n`);
    } else {
      write(context.stderr, `${payload.message}\n`);
    }

    return error instanceof CliError ? error.exitCode : EXIT_CODE.FAILURE;
  }
}

async function handleAuthLogin(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("auth login")}\n`);
    return EXIT_CODE.OK;
  }

  ensureNoPositionals(parsed.positionals, "auth login");

  const token = getStringFlag(parsed, "token");
  if (!token) {
    throw new UsageError("auth login requires --token.");
  }

  const currentConfig = await context.store.load();
  const resolvedApiUrl = resolveApiUrl(currentConfig, context.env, getStringFlag(parsed, "api-url"));
  const client = createApiClient({
    apiUrl: resolvedApiUrl.value,
    token,
    fetchImpl: context.fetchImpl,
  });
  const whoami = await client.getWhoAmI();

  const nextConfig: CliConfig = {
    version: 1,
    token,
    ...(resolvedApiUrl.source !== "default" || currentConfig.apiUrl
      ? { apiUrl: resolvedApiUrl.value }
      : {}),
  };
  await context.store.save(nextConfig);

  if (getBooleanFlag(parsed, "json")) {
    write(
      context.stdout,
      stringifyJson({
        ok: true,
        apiUrl: resolvedApiUrl.value,
        storage: {
          kind: "file",
          path: context.store.getPath(),
        },
        whoami,
      }),
    );
    return EXIT_CODE.OK;
  }

  write(
    context.stdout,
    `${formatWhoAmI(whoami)} savedToken=local-file:${context.store.getPath()}\n`,
  );
  return EXIT_CODE.OK;
}

async function handleAuthWhoAmI(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("auth whoami")}\n`);
    return EXIT_CODE.OK;
  }

  ensureNoPositionals(parsed.positionals, "auth whoami");
  const client = await createAuthedClient(parsed, context);
  const whoami = await client.getWhoAmI();

  return writeSuccess(context.stdout, parsed, whoami, formatWhoAmI(whoami));
}

async function handleAuthLogout(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("auth logout")}\n`);
    return EXIT_CODE.OK;
  }

  ensureNoPositionals(parsed.positionals, "auth logout");
  const currentConfig = await context.store.load();
  const hadToken = Boolean(currentConfig.token);

  if (currentConfig.apiUrl) {
    await context.store.save({ version: 1, apiUrl: currentConfig.apiUrl });
  } else {
    await context.store.clear();
  }

  const payload = { ok: true, removedToken: hadToken };
  return writeSuccess(context.stdout, parsed, payload, hadToken ? "Logged out." : "No stored token.");
}

async function handleWorkspaceList(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("workspace list")}\n`);
    return EXIT_CODE.OK;
  }

  ensureNoPositionals(parsed.positionals, "workspace list");
  const client = await createAuthedClient(parsed, context);
  const items = await client.listWorkspaces();

  return writeSuccess(context.stdout, parsed, items, formatWorkspaceList(items));
}

async function handleDraftList(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("draft list")}\n`);
    return EXIT_CODE.OK;
  }

  ensureNoPositionals(parsed.positionals, "draft list");
  const workspace = requireFlag(parsed, "workspace", "draft list");
  const stack = requireFlag(parsed, "stack", "draft list");
  const client = await createAuthedClient(parsed, context);
  const drafts = await client.listDrafts(workspace, stack);

  return writeSuccess(context.stdout, parsed, drafts, formatDraftList(drafts));
}

async function handleDraftGet(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("draft get")}\n`);
    return EXIT_CODE.OK;
  }

  const draftShortId = requirePositional(parsed, "draft get", "draft short id");
  const client = await createAuthedClient(parsed, context);
  const draft = await client.getDraft(draftShortId);

  return writeSuccess(context.stdout, parsed, draft, formatDraftDetail(draft));
}

async function handleDraftCreate(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("draft create")}\n`);
    return EXIT_CODE.OK;
  }

  ensureNoPositionals(parsed.positionals, "draft create");
  const workspace = requireFlag(parsed, "workspace", "draft create");
  const stack = requireFlag(parsed, "stack", "draft create");
  const client = await createAuthedClient(parsed, context);
  const created = await client.createDraft(workspace, stack, getStringFlag(parsed, "name"));

  return writeSuccess(
    context.stdout,
    parsed,
    created,
    formatDraftCreate(created),
    created.shortId,
  );
}

async function handleDraftWrite(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("draft write")}\n`);
    return EXIT_CODE.OK;
  }

  const yaml = await resolveTextInput(parsed, context, {
    valueFlag: "yaml",
    fileFlag: "file",
    description: "draft YAML",
    allowEmpty: false,
  });
  const client = await createAuthedClient(parsed, context);
  const providedDraftShortId = getOptionalPositional(parsed, "draft write");
  const updated = providedDraftShortId
    ? await client.writeDraft(providedDraftShortId, yaml)
    : await writeDraftWithScope(client, parsed, yaml);

  return writeSuccess(
    context.stdout,
    parsed,
    updated,
    formatDraftMutation(updated),
    updated.shortId,
  );
}

async function handleDraftEdit(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("draft edit")}\n`);
    return EXIT_CODE.OK;
  }

  const oldString = requireFlag(parsed, "old-string", "draft edit");
  const newString = getStringFlag(parsed, "new-string");
  if (newString === undefined) {
    throw new UsageError("draft edit requires --new-string.");
  }

  const client = await createAuthedClient(parsed, context);
  const providedDraftShortId = getOptionalPositional(parsed, "draft edit");
  const updated = providedDraftShortId
    ? await client.editDraft(providedDraftShortId, oldString, newString)
    : await editDraftWithScope(client, parsed, oldString, newString);

  return writeSuccess(
    context.stdout,
    parsed,
    updated,
    formatDraftMutation(updated),
    updated.shortId,
  );
}

async function handleDraftValidate(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("draft validate")}\n`);
    return EXIT_CODE.OK;
  }

  const draftShortId = requirePositional(parsed, "draft validate", "draft short id");
  const client = await createAuthedClient(parsed, context);
  const result = await client.validateDraft(draftShortId);

  return writeSuccess(
    context.stdout,
    parsed,
    result,
    formatDraftValidate(result),
    result.ok ? "ok" : "invalid",
  );
}

async function handleDraftDelete(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("draft delete")}\n`);
    return EXIT_CODE.OK;
  }

  const draftShortId = requirePositional(parsed, "draft delete", "draft short id");
  const client = await createAuthedClient(parsed, context);
  await client.deleteDraft(draftShortId);

  return writeSuccess(
    context.stdout,
    parsed,
    { ok: true, shortId: draftShortId },
    `shortId\t${draftShortId}\ndeleted\ttrue`,
    draftShortId,
  );
}

async function handleRevisionList(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("revision list")}\n`);
    return EXIT_CODE.OK;
  }

  ensureNoPositionals(parsed.positionals, "revision list");
  const workspace = requireFlag(parsed, "workspace", "revision list");
  const stack = requireFlag(parsed, "stack", "revision list");
  const client = await createAuthedClient(parsed, context);
  const revisions = await client.listRevisions(workspace, stack, {
    cursor: getStringFlag(parsed, "cursor"),
    limit: getOptionalIntFlag(parsed, "limit"),
  });

  return writeSuccess(context.stdout, parsed, revisions, formatRevisionList(revisions));
}

async function handleRevisionGet(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("revision get")}\n`);
    return EXIT_CODE.OK;
  }

  const workspace = requireFlag(parsed, "workspace", "revision get");
  const stack = requireFlag(parsed, "stack", "revision get");
  const revisionNumber = getOptionalPositional(parsed, "revision get");
  const client = await createAuthedClient(parsed, context);
  const revision = revisionNumber === undefined
    ? await client.getHeadRevision(workspace, stack)
    : await client.getRevision(workspace, stack, parsePositiveInt(revisionNumber, "revision number"));

  return writeSuccess(context.stdout, parsed, revision, formatRevisionDetail(revision));
}

async function handleRevisionDelete(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("revision delete")}\n`);
    return EXIT_CODE.OK;
  }

  const workspace = requireFlag(parsed, "workspace", "revision delete");
  const stack = requireFlag(parsed, "stack", "revision delete");
  const revisionInput = requirePositional(parsed, "revision delete", "revision number");
  const revisionNumber = parsePositiveInt(revisionInput, "revision number");
  const client = await createAuthedClient(parsed, context);
  const revision = await client.getRevision(workspace, stack, revisionNumber);
  await client.deleteRevision(workspace, stack, revision.id);

  return writeSuccess(
    context.stdout,
    parsed,
    { ok: true, revisionId: revision.id, revisionNumber },
    `revision\t${revisionNumber}\nrevisionId\t${revision.id}\ndeleted\ttrue`,
    revision.id,
  );
}

async function handleRunGet(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("run get")}\n`);
    return EXIT_CODE.OK;
  }

  const runId = requirePositional(parsed, "run get", "run id or short id");
  const client = await createAuthedClient(parsed, context);
  const run = await client.getRun(runId);

  return writeSuccess(context.stdout, parsed, run, formatRunGet(run));
}

async function handleRunList(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("run list")}\n`);
    return EXIT_CODE.OK;
  }

  ensureNoPositionals(parsed.positionals, "run list");
  const workspace = requireFlag(parsed, "workspace", "run list");

  const status = getStringFlag(parsed, "status");
  if (status !== undefined) {
    validateRunStatusFlag("status", status);
  }

  const excludeStatus = getStringFlag(parsed, "exclude-status");
  if (excludeStatus !== undefined) {
    validateRunStatusFlag("exclude-status", excludeStatus);
  }

  const client = await createAuthedClient(parsed, context);
  const runs = await client.listRuns({
    workspace,
    stack: getStringFlag(parsed, "stack"),
    status,
    excludeStatus,
    cursor: getStringFlag(parsed, "cursor"),
    limit: getOptionalIntFlag(parsed, "limit"),
  });

  return writeSuccess(context.stdout, parsed, runs, formatRunList(runs));
}

async function handleRunApply(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("run apply")}\n`);
    return EXIT_CODE.OK;
  }

  ensureNoPositionals(parsed.positionals, "run apply");
  const workspace = requireFlag(parsed, "workspace", "run apply");
  const stack = requireFlag(parsed, "stack", "run apply");
  const envSlug = requireFlag(parsed, "env", "run apply");
  const draftShortId = getStringFlag(parsed, "draft");
  const revisionNumberRaw = getStringFlag(parsed, "revision");
  if (draftShortId && revisionNumberRaw) {
    throw new UsageError("run apply accepts either --draft or --revision, not both.");
  }

  const client = await createAuthedClient(parsed, context);
  const result = await client.applyRun(workspace, stack, {
    envSlug,
    ...(draftShortId ? { draftShortId } : {}),
    ...(revisionNumberRaw ? { revisionNumber: parsePositiveInt(revisionNumberRaw, "--revision") } : {}),
    ...(getBooleanFlag(parsed, "preview-only") ? { previewOnly: true } : {}),
    ...(getStringFlag(parsed, "reason") ? { reason: getStringFlag(parsed, "reason") } : {}),
  });

  return writeSuccess(context.stdout, parsed, result, formatRunApply(result), result.runId);
}

async function handleRunWait(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("run wait")}\n`);
    return EXIT_CODE.OK;
  }

  const runId = requirePositional(parsed, "run wait", "run id or short id");
  const client = await createAuthedClient(parsed, context);
  const result = await client.waitForRun(runId, getOptionalIntFlag(parsed, "timeout-seconds"));

  return writeSuccess(context.stdout, parsed, result, formatRunWait(result), result.run?.status ?? result.status);
}

async function handleRunImport(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("run import")}\n`);
    return EXIT_CODE.OK;
  }

  ensureNoPositionals(parsed.positionals, "run import");
  const workspace = requireFlag(parsed, "workspace", "run import");
  const stack = requireFlag(parsed, "stack", "run import");
  const payload = await resolveImportPayload(parsed, context);
  const envSlug = getStringFlag(parsed, "env") ?? payload.envSlug;
  if (!envSlug) {
    throw new UsageError("run import requires --env or envSlug in the JSON payload.");
  }

  const reason = getStringFlag(parsed, "reason") ?? payload.reason;
  const client = await createAuthedClient(parsed, context);
  const result = await client.importRun(workspace, stack, {
    envSlug,
    targets: payload.targets,
    ...(reason ? { reason } : {}),
  });

  return writeSuccess(context.stdout, parsed, result, formatRunImport(result), result.runId);
}

async function handleRunCancel(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("run cancel")}\n`);
    return EXIT_CODE.OK;
  }

  const runId = requirePositional(parsed, "run cancel", "run id or short id");
  const client = await createAuthedClient(parsed, context);
  const canceled = await client.cancelRun(runId, getBooleanFlag(parsed, "force"));

  return writeSuccess(context.stdout, parsed, canceled, formatRestRun(canceled), canceled.status);
}

async function handleOrgList(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("org list")}\n`);
    return EXIT_CODE.OK;
  }

  ensureNoPositionals(parsed.positionals, "org list");
  const client = await createAuthedClient(parsed, context);
  const items = await client.listOrgVariables();

  return writeSuccess(context.stdout, parsed, items, formatOrgList(items));
}

async function handleOrgSet(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("org set")}\n`);
    return EXIT_CODE.OK;
  }

  const key = requirePositional(parsed, "org set", "key");
  const value = await resolveTextInput(parsed, context, {
    valueFlag: "value",
    fileFlag: "file",
    description: "org variable value",
    allowEmpty: true,
  });
  const client = await createAuthedClient(parsed, context);
  const item = await client.setOrgVariable(key, value, getBooleanFlag(parsed, "sensitive"));

  return writeSuccess(context.stdout, parsed, item, formatOrgVariable(item), item.key);
}

async function handleOrgDelete(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("org delete")}\n`);
    return EXIT_CODE.OK;
  }

  const key = requirePositional(parsed, "org delete", "key");
  const client = await createAuthedClient(parsed, context);
  await client.deleteOrgVariable(key);

  return writeSuccess(
    context.stdout,
    parsed,
    { ok: true, key },
    `key\t${key}\ndeleted\ttrue`,
    key,
  );
}

async function handleOrgGetNotes(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("org get-notes")}\n`);
    return EXIT_CODE.OK;
  }

  ensureNoPositionals(parsed.positionals, "org get-notes");
  const client = await createAuthedClient(parsed, context);

  try {
    const notes = await client.getOrgNotes();
    return writeSuccess(context.stdout, parsed, notes, formatOrgNotes(notes));
  } catch (error) {
    if (error instanceof ApiError && error.apiCode === "NOT_FOUND") {
      const payload = { content: null };
      return writeSuccess(context.stdout, parsed, payload, "No org notes found.");
    }
    throw error;
  }
}

async function handleOrgSetNotes(argv: string[], context: CommandContext): Promise<number> {
  const parsed = parseArgs(argv);
  if (getBooleanFlag(parsed, "help")) {
    write(context.stdout, `${getHelpText("org set-notes")}\n`);
    return EXIT_CODE.OK;
  }

  ensureNoPositionals(parsed.positionals, "org set-notes");
  const shouldClear = getBooleanFlag(parsed, "clear");
  if (shouldClear && (getStringFlag(parsed, "notes") !== undefined || getStringFlag(parsed, "file") !== undefined)) {
    throw new UsageError("org set-notes accepts either --clear or note content, not both.");
  }
  const client = await createAuthedClient(parsed, context);

  if (shouldClear) {
    await clearOrgNotesIfPresent(client);
    return writeSuccess(context.stdout, parsed, { ok: true, cleared: true }, "cleared\ttrue", "cleared");
  }

  const notes = await resolveOptionalTextInput(parsed, context, {
    valueFlag: "notes",
    fileFlag: "file",
    description: "org notes",
    allowEmpty: true,
  });

  if (notes === undefined) {
    throw new UsageError("org set-notes requires --notes, --file, stdin, or --clear.");
  }

  if (notes.length === 0) {
    await clearOrgNotesIfPresent(client);
    return writeSuccess(context.stdout, parsed, { ok: true, cleared: true }, "cleared\ttrue", "cleared");
  }

  const saved = await client.setOrgNotes(notes);
  return writeSuccess(context.stdout, parsed, saved, formatOrgNotes(saved), "saved");
}

async function createAuthedClient(parsed: ParsedArgs, context: CommandContext): Promise<ApiClient> {
  const { apiUrl, token } = await resolveAuth(parsed, context);
  return createApiClient({ apiUrl, token, fetchImpl: context.fetchImpl });
}

async function resolveAuth(parsed: ParsedArgs, context: CommandContext) {
  const config = await context.store.load();
  const token = resolveToken(config, context.env, getStringFlag(parsed, "token"));
  if (!token) {
    throw new CliError("No token configured. Use `opsy auth login --token <pat>` or set OPSY_TOKEN.", {
      code: "UNAUTHENTICATED",
      exitCode: EXIT_CODE.UNAUTHENTICATED,
    });
  }

  const apiUrl = resolveApiUrl(config, context.env, getStringFlag(parsed, "api-url"));
  return { token: token.value, apiUrl: apiUrl.value };
}

async function resolveDraftShortId(
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

async function writeDraftWithScope(client: ApiClient, parsed: ParsedArgs, yaml: string) {
  const workspace = requireFlag(parsed, "workspace", "draft write");
  const stack = requireFlag(parsed, "stack", "draft write");
  const draftShortId = await resolveDraftShortId(client, workspace, stack);
  return client.writeScopedDraft(workspace, stack, draftShortId, yaml);
}

async function editDraftWithScope(client: ApiClient, parsed: ParsedArgs, oldString: string, newString: string) {
  const workspace = requireFlag(parsed, "workspace", "draft edit");
  const stack = requireFlag(parsed, "stack", "draft edit");
  const draftShortId = await resolveDraftShortId(client, workspace, stack);
  return client.editScopedDraft(workspace, stack, draftShortId, oldString, newString);
}

async function resolveImportPayload(parsed: ParsedArgs, context: CommandContext): Promise<{
  envSlug?: string;
  reason?: string;
  targets: Array<{ type: string; name: string; id: string }>;
}> {
  const inline = getStringFlag(parsed, "targets");
  const file = getStringFlag(parsed, "file");
  const hasStdin = hasReadableStdin(context.stdin);

  const sources = [inline !== undefined, file !== undefined, hasStdin].filter(Boolean).length;
  if (sources === 0) {
    throw new UsageError("run import requires --targets, --file, or stdin.");
  }
  if (inline !== undefined && file !== undefined) {
    throw new UsageError("Use either --targets or --file for run import, not both.");
  }
  if ((inline !== undefined || file !== undefined) && hasStdin && file !== "-") {
    throw new UsageError("run import received both explicit input and stdin. Use only one payload source.");
  }

  const raw = inline ?? await readInputSource(context, file);
  return parseImportPayload(raw);
}

function parseImportPayload(raw: string): {
  envSlug?: string;
  reason?: string;
  targets: Array<{ type: string; name: string; id: string }>;
} {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    throw new UsageError(`Import payload must be valid JSON: ${error instanceof Error ? error.message : "parse failed"}`);
  }

  const parsed = ImportPayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new UsageError("Import payload must be either a JSON array of targets or an object with { envSlug?, reason?, targets }.");
  }

  if (Array.isArray(parsed.data)) {
    return { targets: parsed.data };
  }

  return parsed.data;
}

async function resolveTextInput(
  parsed: ParsedArgs,
  context: CommandContext,
  options: {
    valueFlag: string;
    fileFlag?: string;
    description: string;
    allowEmpty: boolean;
  },
): Promise<string> {
  const value = await resolveOptionalTextInput(parsed, context, options);
  if (value === undefined) {
    throw new UsageError(`Provide ${options.description} via --${options.valueFlag}, --${options.fileFlag ?? "file"}, or stdin.`);
  }
  if (!options.allowEmpty && value.length === 0) {
    throw new UsageError(`${options.description} cannot be empty.`);
  }
  return value;
}

async function resolveOptionalTextInput(
  parsed: ParsedArgs,
  context: CommandContext,
  options: {
    valueFlag: string;
    fileFlag?: string;
    description: string;
    allowEmpty: boolean;
  },
): Promise<string | undefined> {
  const value = getStringFlag(parsed, options.valueFlag);
  const file = getStringFlag(parsed, options.fileFlag ?? "file");
  const hasStdin = hasReadableStdin(context.stdin);

  if (value !== undefined && file !== undefined) {
    throw new UsageError(`Use either --${options.valueFlag} or --${options.fileFlag ?? "file"} for ${options.description}, not both.`);
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

async function clearOrgNotesIfPresent(client: ApiClient) {
  try {
    await client.deleteOrgNotes();
  } catch (error) {
    if (!(error instanceof ApiError) || error.apiCode !== "NOT_FOUND") {
      throw error;
    }
  }
}

async function readInputSource(context: CommandContext, file?: string): Promise<string> {
  if (file && file !== "-") {
    const { readFile } = await import("node:fs/promises");
    return readFile(file, "utf8");
  }

  if (!hasReadableStdin(context.stdin)) {
    throw new UsageError("No stdin input available.");
  }

  return readStream(context.stdin);
}

async function readStream(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function hasReadableStdin(stream: InputStream): boolean {
  if (stream === process.stdin) {
    return stream.isTTY === false;
  }
  return stream.isTTY !== true;
}

function requireFlag(parsed: ParsedArgs, name: string, command: string): string {
  const value = getStringFlag(parsed, name);
  if (!value) {
    throw new UsageError(`${command} requires --${name}.`);
  }
  return value;
}

function requirePositional(parsed: ParsedArgs, command: string, label: string): string {
  if (parsed.positionals.length !== 1) {
    throw new UsageError(`${command} requires ${label}.`);
  }
  return parsed.positionals[0];
}

function getOptionalPositional(parsed: ParsedArgs, command: string): string | undefined {
  if (parsed.positionals.length > 1) {
    throw new UsageError(`${command} accepts at most one positional argument.`);
  }
  return parsed.positionals[0];
}

function ensureNoPositionals(positionals: string[], command: string) {
  if (positionals.length > 0) {
    throw new UsageError(`${command} does not accept positional arguments.`);
  }
}

function parsePositiveInt(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new UsageError(`${label} must be a positive integer.`);
  }
  return parsed;
}

function validateRunStatusFlag(name: string, value: string) {
  const parsed = RunStatusEnum.safeParse(value);
  if (!parsed.success) {
    throw new UsageError(`--${name} must be one of: ${RunStatusEnum.options.join(", ")}`);
  }
}

function write(stream: NodeJS.WritableStream, text: string) {
  stream.write(text);
}

function writeSuccess(
  stream: NodeJS.WritableStream,
  parsed: ParsedArgs,
  jsonPayload: unknown,
  textPayload: string,
  quietPayload?: string,
): number {
  if (getBooleanFlag(parsed, "json")) {
    write(stream, stringifyJson(jsonPayload));
    return EXIT_CODE.OK;
  }

  if (getBooleanFlag(parsed, "quiet")) {
    if (quietPayload) {
      write(stream, `${quietPayload}\n`);
    }
    return EXIT_CODE.OK;
  }

  write(stream, `${textPayload}\n`);
  return EXIT_CODE.OK;
}

export function getHelpText(command?: string): string {
  switch (command) {
    case "auth login":
      return "Usage: opsy auth login --token <pat> [--api-url <url>] [--json]";
    case "auth whoami":
      return "Usage: opsy auth whoami [--token <pat>] [--api-url <url>] [--json]";
    case "auth logout":
      return "Usage: opsy auth logout [--json]";
    case "workspace list":
      return "Usage: opsy workspace list [--token <pat>] [--api-url <url>] [--json]";
    case "draft list":
      return "Usage: opsy draft list --workspace <slug> --stack <slug> [--json]";
    case "draft get":
      return "Usage: opsy draft get <draft-short-id> [--json]";
    case "draft create":
      return "Usage: opsy draft create --workspace <slug> --stack <slug> [--name <name>] [--quiet] [--json]";
    case "draft write":
      return "Usage: opsy draft write [draft-short-id] [--workspace <slug> --stack <slug>] [--yaml <yaml> | --file <path> | stdin] [--quiet] [--json]";
    case "draft edit":
      return "Usage: opsy draft edit [draft-short-id] [--workspace <slug> --stack <slug>] --old-string <text> --new-string <text> [--quiet] [--json]";
    case "draft validate":
      return "Usage: opsy draft validate <draft-short-id> [--quiet] [--json]";
    case "draft delete":
      return "Usage: opsy draft delete <draft-short-id> [--quiet] [--json]";
    case "revision list":
      return "Usage: opsy revision list --workspace <slug> --stack <slug> [--cursor <cursor>] [--limit <n>] [--json]";
    case "revision get":
      return "Usage: opsy revision get [revision-number] --workspace <slug> --stack <slug> [--json]";
    case "revision delete":
      return "Usage: opsy revision delete <revision-number> --workspace <slug> --stack <slug> [--quiet] [--json]";
    case "run get":
      return "Usage: opsy run get <run-id|short-id> [--json]";
    case "run list":
      return "Usage: opsy run list --workspace <slug> [--stack <slug>] [--status <status>] [--exclude-status <status>] [--limit <n>] [--cursor <cursor>] [--json]";
    case "run apply":
      return "Usage: opsy run apply --workspace <slug> --stack <slug> --env <slug> [--draft <short-id> | --revision <n>] [--preview-only] [--reason <text>] [--quiet] [--json]";
    case "run wait":
      return "Usage: opsy run wait <run-id|short-id> [--timeout-seconds <n>] [--quiet] [--json]";
    case "run import":
      return "Usage: opsy run import --workspace <slug> --stack <slug> [--env <slug>] [--targets <json> | --file <path> | stdin] [--reason <text>] [--quiet] [--json]";
    case "run cancel":
      return "Usage: opsy run cancel <run-id|short-id> [--force] [--quiet] [--json]";
    case "org list":
      return "Usage: opsy org list [--json]";
    case "org set":
      return "Usage: opsy org set <key> [--value <text> | --file <path> | stdin] [--sensitive] [--quiet] [--json]";
    case "org delete":
      return "Usage: opsy org delete <key> [--quiet] [--json]";
    case "org get-notes":
      return "Usage: opsy org get-notes [--json]";
    case "org set-notes":
      return "Usage: opsy org set-notes [--notes <text> | --file <path> | stdin | --clear] [--quiet] [--json]";
    default:
      return [
        "Usage:",
        "  opsy auth login --token <pat> [--api-url <url>] [--json]",
        "  opsy auth whoami [--token <pat>] [--api-url <url>] [--json]",
        "  opsy auth logout [--json]",
        "  opsy workspace list [--json]",
        "  opsy draft list|get|create|write|edit|validate|delete ...",
        "  opsy revision list|get|delete ...",
        "  opsy run get|list|apply|wait|import|cancel ...",
        "  opsy org list|set|delete|get-notes|set-notes ...",
      ].join("\n");
  }
}
