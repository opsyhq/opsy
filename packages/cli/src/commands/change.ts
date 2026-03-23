import { Command } from "commander";
import { getToken, getApiUrl } from "../config";
import { apiRequest } from "../client";
import { formatTable, output } from "../output";

export const changeCmd = new Command("change").description("Manage changes");

changeCmd
  .command("create")
  .description("Create a change")
  .requiredOption("--project <slug>", "Project slug")
  .requiredOption("--env <slug>", "Environment slug")
  .option("--mutations <json>", "Mutations JSON array")
  .option("--summary <text>", "Change summary")
  .option("--apply", "Apply immediately after creating the change")
  .action(async function (this: Command, opts: { project: string; env: string; mutations?: string; summary?: string; apply?: boolean }) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      if (opts.apply && !opts.mutations) {
        throw new Error("--apply requires --mutations");
      }

      let result: any;
      if (opts.mutations) {
        const body: any = { mutations: JSON.parse(opts.mutations) };
        if (opts.summary) body.summary = opts.summary;
        result = await apiRequest<any>(`/projects/${opts.project}/environments/${opts.env}/changes`, {
          method: "POST",
          body,
          token,
          apiUrl,
        });
      } else {
        result = await apiRequest<any>(`/projects/${opts.project}/environments/${opts.env}/changes`, {
          method: "POST",
          body: opts.summary ? { summary: opts.summary } : {},
          token,
          apiUrl,
        });
      }

      if (opts.apply && result.change?.shortId) {
        const applied = await apiRequest<any>(`/changes/${result.change.shortId}/apply`, {
          method: "POST",
          token,
          apiUrl,
        });
        result = { ...result, apply: applied };
      }

      if (flags.json) return output(result, flags);

      const shortId = result.change?.shortId ?? result.shortId;
      const opCount = result.operations?.length;
      if (typeof opCount === "number") {
        console.log(`Change ${shortId} created with ${opCount} operation(s).`);
      } else {
        console.log(`Change ${shortId} created.`);
      }

      if (result.apply?.events) {
        for (const event of result.apply.events) {
          const status = event.data?.status ?? "";
          const slug = event.data?.resourceSlug ?? "";
          console.log(`${event.event}: ${slug} ${status}`);
        }
      }
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

changeCmd
  .command("update <shortId>")
  .description("Append mutations to an open change")
  .requiredOption("--mutations <json>", "Mutations JSON array")
  .option("--summary <text>", "Change summary override")
  .option("--apply", "Apply immediately after updating the change")
  .action(async function (this: Command, shortId: string, opts: { mutations: string; summary?: string; apply?: boolean }) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const body: any = {
        mutations: JSON.parse(opts.mutations),
      };
      if (opts.summary) body.summary = opts.summary;
      let result = await apiRequest<any>(`/changes/${shortId}/mutations`, {
        method: "POST",
        body,
        token,
        apiUrl,
      });

      if (opts.apply) {
        const applied = await apiRequest<any>(`/changes/${shortId}/apply`, {
          method: "POST",
          token,
          apiUrl,
        });
        result = { ...result, apply: applied };
      }

      if (flags.json) return output(result, flags);
      console.log(`${result.operations.length} operation(s) added to change ${shortId}.`);
      if (result.apply?.events) {
        for (const event of result.apply.events) {
          const status = event.data?.status ?? "";
          const slug = event.data?.resourceSlug ?? "";
          console.log(`${event.event}: ${slug} ${status}`);
        }
      }
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

changeCmd
  .command("list")
  .description("List changes")
  .requiredOption("--project <slug>", "Project slug")
  .requiredOption("--env <slug>", "Environment slug")
  .action(async function (this: Command, opts: { project: string; env: string }) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const changes = await apiRequest<any[]>(`/projects/${opts.project}/environments/${opts.env}/changes`, { token, apiUrl });
      if (flags.json) return output(changes, flags);
      if (!changes.length) return console.log("No changes found.");
      console.log(formatTable(
        ["SHORT-ID", "STATUS", "SUMMARY", "CREATED"],
        changes.map((c) => [c.shortId, c.status, c.summary ?? "-", new Date(c.createdAt).toLocaleDateString()]),
      ));
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

changeCmd
  .command("get <shortId>")
  .description("Get change details")
  .action(async function (this: Command, shortId: string) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const result = await apiRequest<any>(`/changes/${shortId}`, { token, apiUrl });
      if (flags.json) return output(result, flags);
      const c = result.change;
      console.log(`Change ${c.shortId} (${c.status})`);
      if (c.summary) console.log(`Summary: ${c.summary}`);
      console.log(`\nOperations (${result.operations.length}):`);
      for (const op of result.operations) {
        console.log(`  ${op.kind.toUpperCase()} ${op.resourceSlug} (${op.resourceType}) — ${op.status}`);
        if (op.error) console.log(`    Error: ${op.error}`);
      }
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

changeCmd
  .command("preview <shortId>")
  .description("Preview a change")
  .action(async function (this: Command, shortId: string) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const result = await apiRequest<any>(`/changes/${shortId}/preview`, { method: "POST", token, apiUrl });
      if (flags.json) return output(result, flags);
      console.log(`Preview for ${shortId}:`);
      for (const op of result.operations) {
        const prefix = op.kind === "create" ? "+" : op.kind === "delete" ? "-" : "~";
        console.log(`  ${prefix} ${op.resourceSlug} (${op.kind})`);
        if (op.diff) console.log(`    ${JSON.stringify(op.diff)}`);
      }
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

changeCmd
  .command("apply <shortId>")
  .description("Apply a change")
  .action(async function (this: Command, shortId: string) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const result = await apiRequest<any>(`/changes/${shortId}/apply`, { method: "POST", token, apiUrl });
      if (flags.json) return output(result, flags);
      if (result.events) {
        for (const event of result.events) {
          const status = event.data?.status ?? "";
          const slug = event.data?.resourceSlug ?? "";
          console.log(`${event.event}: ${slug} ${status}`);
        }
      }
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

changeCmd
  .command("dismiss <shortId>")
  .description("Dismiss a change")
  .action(async function (this: Command, shortId: string) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const result = await apiRequest<any>(`/changes/${shortId}/dismiss`, { method: "POST", token, apiUrl });
      if (flags.json) return output(result, flags);
      console.log(`Change ${result.shortId} dismissed.`);
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

changeCmd
  .command("retry <shortId>")
  .description("Retry a failed change")
  .action(async function (this: Command, shortId: string) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const result = await apiRequest<any>(`/changes/${shortId}/retry`, { method: "POST", token, apiUrl });
      if (flags.json) return output(result, flags);
      console.log(`Change ${result.shortId} retried — now ${result.status}.`);
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });
