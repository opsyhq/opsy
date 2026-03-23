import { Command } from "commander";
import { getToken, getApiUrl } from "../config";
import { apiRequest } from "../client";
import { formatTable, output } from "../output";

type GlobalFlags = {
  token?: string;
  apiUrl?: string;
  json?: boolean;
  quiet?: boolean;
};

type ResourceDeps = {
  apiRequest: typeof apiRequest;
  getToken: typeof getToken;
  getApiUrl: typeof getApiUrl;
  log: (message?: string) => void;
  error: (message?: string) => void;
  exit: (code: number) => never;
};

const defaultDeps: ResourceDeps = {
  apiRequest,
  getToken,
  getApiUrl,
  log: (message?: string) => console.log(message),
  error: (message?: string) => console.error(message),
  exit: (code: number) => process.exit(code),
};

function getRootFlags(command: Command): GlobalFlags {
  let current = command;
  while (current.parent) current = current.parent;
  return current.opts<GlobalFlags>();
}

function handleCliError(error: unknown, deps: ResourceDeps): never {
  deps.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  return deps.exit(1);
}

export function createResourceCommand(deps: ResourceDeps = defaultDeps) {
  const resourceCmd = new Command("resource").description("Manage resources");

  resourceCmd
    .command("ls")
    .description("List resources")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--env <slug>", "Environment slug")
    .option("--parent <slug>", "Parent resource slug")
    .action(async function (this: Command, opts: { project: string; env: string; parent?: string }) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      const qs = opts.parent ? `?parent=${opts.parent}` : "";
      try {
        const resources = await deps.apiRequest<any[]>(`/projects/${opts.project}/environments/${opts.env}/resources${qs}`, { token, apiUrl });
        if (flags.json) return output(resources, flags);
        if (!resources.length) {
          deps.log("No resources found.");
          return;
        }
        deps.log(formatTable(
          ["SLUG", "TYPE", "STATUS"],
          resources.map((resource) => [resource.slug, resource.type, resource.status]),
        ));
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  resourceCmd
    .command("get <slug>")
    .description("Get resource details")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--env <slug>", "Environment slug")
    .option("--live", "Include live cloud outputs")
    .action(async function (this: Command, slug: string, opts: { project: string; env: string; live?: boolean }) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      try {
        const resource = await deps.apiRequest<any>(`/projects/${opts.project}/environments/${opts.env}/resources/${slug}`, { token, apiUrl });
        if (!opts.live) {
          output(resource, flags);
          return;
        }

        try {
          const live = await deps.apiRequest<any>(`/projects/${opts.project}/environments/${opts.env}/resources/${slug}/live`, { token, apiUrl });
          output({ ...resource, live }, flags);
        } catch (error) {
          deps.error(`Warning: failed to read live outputs: ${error instanceof Error ? error.message : String(error)}`);
          output(resource, flags);
        }
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  resourceCmd
    .command("sync <slug>")
    .description("Re-read a resource from cloud and refresh conflict state")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--env <slug>", "Environment slug")
    .action(async function (this: Command, slug: string, opts: { project: string; env: string }) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      try {
        const result = await deps.apiRequest<any>(
          `/projects/${opts.project}/environments/${opts.env}/resources/${slug}/sync`,
          { method: "POST", token, apiUrl },
        );
        output(result, flags);
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  resourceCmd
    .command("accept-live <slug>")
    .description("Accept the recorded live conflict snapshot into stored inputs")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--env <slug>", "Environment slug")
    .action(async function (this: Command, slug: string, opts: { project: string; env: string }) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      try {
        const result = await deps.apiRequest<any>(
          `/projects/${opts.project}/environments/${opts.env}/resources/${slug}/accept-live`,
          { method: "POST", token, apiUrl },
        );
        output(result, flags);
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  resourceCmd
    .command("promote-current <slug>")
    .description("Create a change to push stored desired inputs back to the cloud")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--env <slug>", "Environment slug")
    .action(async function (this: Command, slug: string, opts: { project: string; env: string }) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      try {
        const result = await deps.apiRequest<any>(
          `/projects/${opts.project}/environments/${opts.env}/resources/${slug}/promote-current`,
          { method: "POST", token, apiUrl },
        );
        if (flags.json) {
          output(result, flags);
          return;
        }
        deps.log(`Change ${result.change.shortId} created with ${result.operations.length} operation(s).`);
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  resourceCmd
    .command("restore <slug>")
    .description("Create a change that restores the resource inputs captured before an operation")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--env <slug>", "Environment slug")
    .requiredOption("--operation <id>", "Operation ID to restore from")
    .action(async function (this: Command, slug: string, opts: { project: string; env: string; operation: string }) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      try {
        const result = await deps.apiRequest<any>(
          `/projects/${opts.project}/environments/${opts.env}/resources/${slug}/restore`,
          { method: "POST", body: { operationId: opts.operation }, token, apiUrl },
        );
        if (flags.json) {
          output(result, flags);
          return;
        }
        deps.log(`Change ${result.change.shortId} created with ${result.operations.length} operation(s).`);
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  resourceCmd
    .command("tree")
    .description("Show resource tree")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--env <slug>", "Environment slug")
    .option("--depth <n>", "Tree depth", "3")
    .action(async function (this: Command, opts: { project: string; env: string; depth: string }) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      try {
        const tree = await deps.apiRequest<any[]>(`/projects/${opts.project}/environments/${opts.env}/resources/tree?depth=${opts.depth}`, { token, apiUrl });
        if (flags.json) return output(tree, flags);
        if (!tree.length) {
          deps.log("No resources found.");
          return;
        }
        function printNode(node: any, indent: string) {
          const status = node.status === "live" ? "\u2713" : node.status === "failed" ? "\u2717" : "\u00b7";
          deps.log(`${indent}${status} ${node.slug} (${node.type}) [${node.status}]`);
          for (const child of node.children ?? []) printNode(child, indent + "  ");
        }
        for (const node of tree) printNode(node, "");
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  return resourceCmd;
}

export const resourceCmd = createResourceCommand();
