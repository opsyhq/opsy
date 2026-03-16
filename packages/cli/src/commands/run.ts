import type { Command } from "commander";
import type { CommandContext } from "./helpers.js";
import { getHelpText } from "../help.js";
import {
  addCommonOptions,
  createGroupCommand,
  write,
  writeSuccess,
  createAuthedClient,
  requireOpt,
  resolveImportPayload,
  parsePositiveInt,
  validateRunStatusFlag,
} from "./helpers.js";
import { UsageError } from "../errors.js";
import {
  formatRestRun,
  formatRunApply,
  formatRunGet,
  formatRunImport,
  formatRunList,
  formatRunWait,
} from "../output.js";

export function registerRunCommands(parent: Command, ctx: CommandContext) {
  const group = createGroupCommand(parent, "run", ctx)
    .description("Manage runs.");

  addCommonOptions(group.command("get"))
    .description("Show run details.")
    .argument("<id>", "Run ID or short ID")
    .configureHelp({ formatHelp: () => getHelpText("run get") + "\n" })
    .action(async (runId, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const client = await createAuthedClient(allOpts, ctx);
      const run = await client.getRun(runId);
      writeSuccess(ctx.stdout, allOpts, run, formatRunGet(run));
    });

  addCommonOptions(group.command("list"))
    .description("List runs for a workspace.")
    .option("--workspace <slug>", "Workspace slug")
    .option("--stack <slug>", "Filter by stack")
    .option("--status <status>", "Filter by status")
    .option("--exclude-status <status>", "Exclude by status")
    .option("--limit <n>", "Max results")
    .option("--cursor <cursor>", "Pagination cursor")
    .configureHelp({ formatHelp: () => getHelpText("run list") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "run list");

      if (opts.status !== undefined) {
        validateRunStatusFlag("status", opts.status, "run list");
      }
      if (opts.excludeStatus !== undefined) {
        validateRunStatusFlag("exclude-status", opts.excludeStatus, "run list");
      }

      const limit = opts.limit ? parsePositiveInt(opts.limit, "--limit", "run list") : undefined;
      const client = await createAuthedClient(allOpts, ctx);
      const runs = await client.listRuns({
        workspace,
        stack: opts.stack,
        status: opts.status,
        excludeStatus: opts.excludeStatus,
        cursor: opts.cursor,
        limit,
      });
      writeSuccess(ctx.stdout, allOpts, runs, formatRunList(runs));
    });

  addCommonOptions(group.command("apply"))
    .description("Queue an apply run.")
    .option("--workspace <slug>", "Workspace slug")
    .option("--stack <slug>", "Stack slug")
    .option("--env <slug>", "Environment slug")
    .option("--draft <short-id>", "Draft to apply")
    .option("--revision <n>", "Revision number to apply")
    .option("--preview-only", "Preview changes without applying")
    .option("--reason <text>", "Reason for the run")
    .configureHelp({ formatHelp: () => getHelpText("run apply") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "run apply");
      const stack = requireOpt(opts.stack, "stack", "run apply");

      if (opts.draft && opts.revision) {
        throw new UsageError("run apply accepts either --draft or --revision, not both.", { command: "run apply" });
      }

      const client = await createAuthedClient(allOpts, ctx);
      const result = await client.applyRun(workspace, stack, {
        ...(opts.env ? { envSlug: opts.env } : {}),
        ...(opts.draft ? { draftShortId: opts.draft } : {}),
        ...(opts.revision ? { revisionNumber: parsePositiveInt(opts.revision, "--revision", "run apply") } : {}),
        ...(opts.previewOnly ? { previewOnly: true } : {}),
        ...(opts.reason ? { reason: opts.reason } : {}),
      });
      writeSuccess(ctx.stdout, allOpts, result, formatRunApply(result), result.runId);
    });

  addCommonOptions(group.command("destroy"))
    .description("Queue a destroy run.")
    .option("--workspace <slug>", "Workspace slug")
    .option("--stack <slug>", "Stack slug")
    .option("--env <slug>", "Environment slug")
    .option("--reason <text>", "Reason for the run")
    .configureHelp({ formatHelp: () => getHelpText("run destroy") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "run destroy");
      const stack = requireOpt(opts.stack, "stack", "run destroy");
      const client = await createAuthedClient(allOpts, ctx);
      const result = await client.destroyRun(workspace, stack, {
        ...(opts.env ? { envSlug: opts.env } : {}),
        ...(opts.reason ? { reason: opts.reason } : {}),
      });
      writeSuccess(ctx.stdout, allOpts, result, formatRunApply(result), result.runId);
    });

  addCommonOptions(group.command("wait"))
    .description("Wait for a run to finish.")
    .argument("<id>", "Run ID or short ID")
    .option("--timeout-seconds <n>", "Max wait time in seconds")
    .configureHelp({ formatHelp: () => getHelpText("run wait") + "\n" })
    .action(async (runId, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const client = await createAuthedClient(allOpts, ctx);
      const timeoutSeconds = opts.timeoutSeconds ? parsePositiveInt(opts.timeoutSeconds, "--timeout-seconds", "run wait") : undefined;
      const result = await client.waitForRun(runId, timeoutSeconds);
      writeSuccess(ctx.stdout, allOpts, result, formatRunWait(result), result.run?.status ?? result.status);
    });

  addCommonOptions(group.command("import"))
    .description("Import existing resources.")
    .option("--workspace <slug>", "Workspace slug")
    .option("--stack <slug>", "Stack slug")
    .option("--env <slug>", "Environment slug")
    .option("--targets <json>", "Import targets as JSON")
    .option("--file <path>", "Read targets from file")
    .option("--reason <text>", "Reason for the import")
    .configureHelp({ formatHelp: () => getHelpText("run import") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "run import");
      const stack = requireOpt(opts.stack, "stack", "run import");

      const payload = await resolveImportPayload(opts, ctx);
      const reason = opts.reason ?? payload.reason;
      const client = await createAuthedClient(allOpts, ctx);
      const result = await client.importRun(workspace, stack, {
        ...(opts.env ?? payload.envSlug ? { envSlug: opts.env ?? payload.envSlug } : {}),
        targets: payload.targets,
        ...(reason ? { reason } : {}),
      });
      writeSuccess(ctx.stdout, allOpts, result, formatRunImport(result), result.runId);
    });

  addCommonOptions(group.command("cancel"))
    .description("Cancel a run.")
    .argument("<id>", "Run ID or short ID")
    .option("--force", "Force cancel")
    .configureHelp({ formatHelp: () => getHelpText("run cancel") + "\n" })
    .action(async (runId, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const client = await createAuthedClient(allOpts, ctx);
      const canceled = await client.cancelRun(runId, opts.force);
      writeSuccess(ctx.stdout, allOpts, canceled, formatRestRun(canceled), canceled.status);
    });
}
