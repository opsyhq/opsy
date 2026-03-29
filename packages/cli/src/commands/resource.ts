import { Command } from "commander";
import type { ChangeDetailView, ResourceDetailView, ResourceDiffView, ResourceHistoryEntry, ResourceSummaryRow } from "@opsy/contracts";
import {
  addSharedHelp,
  buildQuery,
  defaultCliDeps,
  getRootFlags,
  handleCliError,
  parseJsonFlag,
  requireArgumentValue,
  requireOptionValue,
  requireProjectValue,
  type CliDeps,
} from "./common";
import {
  renderChangeDetail,
  renderResourceDetail,
  renderResourceDiff,
  renderResourceHistoryTable,
  renderResourceSummaryTable,
} from "../display";
import { output } from "../output";

async function fetchChangeDetailView(
  deps: CliDeps,
  shortId: string,
  flags: ReturnType<typeof getRootFlags>,
): Promise<ChangeDetailView> {
  const token = deps.getToken(flags);
  const apiUrl = deps.getApiUrl(flags);
  return deps.apiRequest<ChangeDetailView>(`/changes/${shortId}`, { token, apiUrl });
}

export function createResourceCommand(deps: CliDeps = defaultCliDeps) {
  const resourceCmd = new Command("resource").description("List, inspect, and mutate resources");

  addSharedHelp(
    resourceCmd.command("list")
      .description("List resources")
      .option("--project <slug>", "Project slug")
      .option("--parent <slug>", "Parent resource slug")
      .option("--detailed", "Return full resource detail objects")
      .action(async function (this: Command, opts: { project?: string; parent?: string; detailed?: boolean }) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const path = `/projects/${project}/resources${buildQuery({
            parent: opts.parent,
            view: flags.json || opts.detailed ? "raw" : undefined,
          })}`;
          const resources = await deps.apiRequest<any[]>(path, { token, apiUrl });
          if (flags.json || opts.detailed) return output(resources, flags);
          if (!resources.length) return deps.log("No resources found.");
          deps.log(renderResourceSummaryTable(resources as ResourceSummaryRow[]));
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "list"],
  );

  addSharedHelp(
    resourceCmd.command("get")
      .description("Get one managed Opsy resource record")
      .argument("[slug]")
      .option("--project <slug>", "Project slug")
      .option("--live", "Include live resource comparison")
      .action(async function (this: Command, slug: string | undefined, opts: { project?: string; live?: boolean }) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          if (!opts.live) {
            const path = `/projects/${project}/resources/${resourceSlug}${flags.json ? buildQuery({ view: "raw" }) : ""}`;
            const data = await deps.apiRequest<any>(path, { token, apiUrl });
            if (flags.json) return output(data, flags);
            deps.log(renderResourceDetail(data as ResourceDetailView));
            return;
          }
          return output(await deps.apiRequest<any>(`/projects/${project}/resources/read${buildQuery({ slug: resourceSlug })}`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "get"],
  );

  addSharedHelp(
    resourceCmd.command("discover")
      .description("Discover managed and unmanaged provider inventory")
      .option("--project <slug>", "Project slug")
      .option("--provider <provider>", "Provider id (aws or cloudflare)")
      .option("--type <type>", "Optional type filter")
      .option("--profile <profileId>", "Integration profile ID")
      .option("--location <location>", "Location filter")
      .option("--region <region>", "Alias for --location")
      .action(async function (
        this: Command,
        opts: { project?: string; provider?: string; type?: string; profile?: string; location?: string; region?: string },
      ) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const location = opts.location ?? opts.region;
          const path = `/projects/${project}/resources/discover${buildQuery({
            provider: opts.provider,
            type: opts.type,
            profileId: opts.profile,
            location,
          })}`;
          output(await deps.apiRequest<any[]>(path, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "discover"],
  );

  addSharedHelp(
    resourceCmd.command("read")
      .description("Read live provider state for a managed slug or external selector")
      .argument("[slug]")
      .option("--project <slug>", "Project slug")
      .option("--type <type>", "External resource type")
      .option("--provider-id <id>", "External provider ID")
      .option("--provider <provider>", "Provider id (aws or cloudflare)")
      .option("--profile <profileId>", "Integration profile ID")
      .action(async function (
        this: Command,
        slug: string | undefined,
        opts: { project?: string; type?: string; providerId?: string; provider?: string; profile?: string },
      ) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const path = `/projects/${project}/resources/read${buildQuery({
            slug,
            type: opts.type,
            providerId: opts.providerId,
            provider: opts.provider,
            profileId: opts.profile,
          })}`;
          output(await deps.apiRequest<any>(path, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "read"],
  );

  addSharedHelp(
    resourceCmd.command("import")
      .description("Import an external resource into managed Opsy state")
      .option("--project <slug>", "Project slug")
      .option("--slug <slug>", "Managed resource slug")
      .option("--type <type>", "Resource type")
      .option("--provider-id <id>", "External provider ID")
      .option("--profile <profileId>", "Integration profile ID")
      .option("--summary <text>", "Change summary")
      .action(async function (
        this: Command,
        opts: { project?: string; slug?: string; type?: string; providerId?: string; profile?: string; summary?: string },
      ) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const result = await deps.apiRequest<any>(`/projects/${project}/resources/import`, {
            method: "POST",
            body: {
              slug: requireOptionValue(opts.slug, "slug"),
              type: requireOptionValue(opts.type, "type"),
              providerId: requireOptionValue(opts.providerId, "provider-id"),
              profileId: opts.profile,
              summary: opts.summary,
            },
            token,
            apiUrl,
          });
          if (flags.json) return output(result, flags);
          if (result?.change?.shortId) {
            deps.log(renderChangeDetail(await fetchChangeDetailView(deps, result.change.shortId, flags)));
            return;
          }
          output(result, flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "import"],
  );

  addSharedHelp(
    resourceCmd.command("create")
      .description("Create one resource; preview by default, or pass --auto-apply to apply immediately")
      .option("--project <slug>", "Project slug")
      .option("--slug <slug>", "Resource slug")
      .option("--type <type>", "Resource token")
      .option("--inputs <json>", "Inputs JSON object")
      .option("--parent <slug>", "Parent resource slug")
      .option("--depends-on <json>", "JSON array of dependency slugs")
      .option("--auto-apply", "Apply immediately after preview")
      .option("--summary <text>", "Change summary")
      .action(async function (
        this: Command,
        opts: { project?: string; slug?: string; type?: string; inputs?: string; parent?: string; dependsOn?: string; autoApply?: boolean; summary?: string },
      ) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const resourceSlug = requireOptionValue(opts.slug, "slug");
          const type = requireOptionValue(opts.type, "type");
          const inputs = parseJsonFlag(requireOptionValue(opts.inputs, "inputs"), "inputs");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const result = await deps.apiRequest<any>(`/projects/${project}/resources`, {
            method: "POST",
            body: {
              slug: resourceSlug,
              type,
              inputs,
              parent: opts.parent,
              dependsOn: opts.dependsOn ? parseJsonFlag(opts.dependsOn, "depends-on") : undefined,
              autoApply: opts.autoApply === true ? true : undefined,
              summary: opts.summary,
            },
            token,
            apiUrl,
          });
          if (flags.json) return output(result, flags);
          if (result?.change?.shortId) {
            deps.log(renderChangeDetail(await fetchChangeDetailView(deps, result.change.shortId, flags)));
            return;
          }
          output(result, flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "create"],
  );

  addSharedHelp(
    resourceCmd.command("update")
      .description("Update one resource; preview by default, or pass --auto-apply to apply immediately")
      .argument("[slug]")
      .option("--project <slug>", "Project slug")
      .option("--inputs <json>", "Inputs JSON object")
      .option("--summary <text>", "Change summary")
      .option("--remove-input-paths <json>", "JSON array of input paths to remove")
      .option("--parent <slug>", "New parent slug")
      .option("--depends-on <json>", "JSON array of dependency slugs")
      .option("--auto-apply", "Apply immediately after preview")
      .option("--version <n>", "Optimistic-lock version")
      .action(async function (
        this: Command,
        slug: string | undefined,
        opts: { project?: string; inputs?: string; summary?: string; removeInputPaths?: string; parent?: string; dependsOn?: string; autoApply?: boolean; version?: string },
      ) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const inputs = parseJsonFlag(requireOptionValue(opts.inputs, "inputs"), "inputs");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const result = await deps.apiRequest<any>(
            `/projects/${project}/resources/${resourceSlug}`,
            {
              method: "PUT",
              body: {
                inputs,
                summary: opts.summary,
                removeInputPaths: opts.removeInputPaths ? parseJsonFlag(opts.removeInputPaths, "remove-input-paths") : undefined,
                parent: opts.parent,
                dependsOn: opts.dependsOn ? parseJsonFlag(opts.dependsOn, "depends-on") : undefined,
                autoApply: opts.autoApply === true ? true : undefined,
                version: opts.version ? Number(opts.version) : undefined,
              },
              token,
              apiUrl,
            },
          );
          if (flags.json) return output(result, flags);
          if (result?.change?.shortId) {
            deps.log(renderChangeDetail(await fetchChangeDetailView(deps, result.change.shortId, flags)));
            return;
          }
          output(result, flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "update"],
  );

  addSharedHelp(
    resourceCmd.command("delete")
      .description("Delete one managed resource or one external provider object; preview by default, or pass --auto-apply to apply immediately")
      .argument("[slug]")
      .option("--project <slug>", "Project slug")
      .option("--type <type>", "External resource type")
      .option("--provider-id <id>", "External provider ID")
      .option("--profile <profileId>", "Integration profile ID")
      .option("--recursive", "Delete descendants too")
      .option("--auto-apply", "Apply immediately after preview")
      .action(async function (
        this: Command,
        slug: string | undefined,
        opts: { project?: string; type?: string; providerId?: string; profile?: string; recursive?: boolean; autoApply?: boolean },
      ) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const result = await deps.apiRequest<any>(
            `/projects/${project}/resources`,
            {
              method: "DELETE",
              body: slug
                ? { slug, recursive: opts.recursive, autoApply: opts.autoApply === true ? true : undefined }
                : {
                    type: requireOptionValue(opts.type, "type"),
                    providerId: requireOptionValue(opts.providerId, "provider-id"),
                    profileId: opts.profile,
                    autoApply: opts.autoApply === true ? true : undefined,
                  },
              token,
              apiUrl,
            },
          );
          if (flags.json) return output(result, flags);
          if (result?.change?.shortId) {
            deps.log(renderChangeDetail(await fetchChangeDetailView(deps, result.change.shortId, flags)));
            return;
          }
          output(result, flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "delete"],
  );

  addSharedHelp(
    resourceCmd.command("forget")
      .description("Forget one resource from Opsy state and immediately attempt apply")
      .argument("[slug]")
      .option("--project <slug>", "Project slug")
      .option("--recursive", "Forget descendants too")
      .option("--target-dependents", "Forget graph dependents too")
      .option("--summary <text>", "Change summary")
      .action(async function (
        this: Command,
        slug: string | undefined,
        opts: { project?: string; recursive?: boolean; targetDependents?: boolean; summary?: string },
      ) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const result = await deps.apiRequest<any>(
            `/projects/${project}/changes`,
            {
              method: "POST",
              body: {
                mutations: [{
                  kind: "forget",
                  slug: resourceSlug,
                  recursive: opts.recursive,
                  targetDependents: opts.targetDependents,
                }],
                summary: opts.summary ?? `Forget ${resourceSlug}`,
              },
              token,
              apiUrl,
            },
          );
          if (flags.json) return output(result, flags);
          if (result?.change?.shortId) {
            deps.log(renderChangeDetail(await fetchChangeDetailView(deps, result.change.shortId, flags)));
            return;
          }
          output(result, flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "forget"],
  );

  addSharedHelp(
    resourceCmd.command("diff")
      .description("Diff one resource")
      .argument("[slug]")
      .option("--project <slug>", "Project slug")
      .action(async function (this: Command, slug: string | undefined, opts: { project?: string }) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const data = await deps.apiRequest<any>(
            `/projects/${project}/resources/${resourceSlug}/diff${flags.json ? buildQuery({ view: "raw" }) : ""}`,
            { token, apiUrl },
          );
          if (flags.json) return output(data, flags);
          deps.log(renderResourceDiff(data as ResourceDiffView));
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "diff"],
  );

  addSharedHelp(
    resourceCmd.command("refresh")
      .description("Refresh one resource")
      .argument("[slug]")
      .option("--project <slug>", "Project slug")
      .action(async function (this: Command, slug: string | undefined, opts: { project?: string }) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(
            `/projects/${project}/resources/${resourceSlug}/sync`,
            {
              method: "POST",
              token,
              apiUrl,
            }),
            flags,
          );
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "refresh"],
  );

  addSharedHelp(
    resourceCmd.command("accept-live")
      .description("Accept recorded live state into desired inputs immediately")
      .argument("[slug]")
      .option("--project <slug>", "Project slug")
      .action(async function (this: Command, slug: string | undefined, opts: { project?: string }) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(
            `/projects/${project}/resources/${resourceSlug}/accept-live`,
            {
              method: "POST",
              token,
              apiUrl,
            }),
            flags,
          );
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "accept-live"],
  );

  addSharedHelp(
    resourceCmd.command("reconcile")
      .description("Promote recorded live state into desired inputs through a change")
      .argument("[slug]")
      .option("--project <slug>", "Project slug")
      .action(async function (this: Command, slug: string | undefined, opts: { project?: string }) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(
            `/projects/${project}/resources/${resourceSlug}/promote-current`,
            {
              method: "POST",
              token,
              apiUrl,
            }),
            flags,
          );
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "reconcile"],
  );

  addSharedHelp(
    resourceCmd.command("restore")
      .description("Restore one resource from an operation snapshot")
      .argument("[slug]")
      .option("--project <slug>", "Project slug")
      .option("--operation <id>", "Operation id")
      .action(async function (this: Command, slug: string | undefined, opts: { project?: string; operation?: string }) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const operation = requireOptionValue(opts.operation, "operation");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(
            `/projects/${project}/resources/${resourceSlug}/restore`,
            {
              method: "POST",
              body: { operationId: operation },
              token,
              apiUrl,
            }),
            flags,
          );
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "restore"],
  );

  addSharedHelp(
    resourceCmd.command("history")
      .description("List history for one resource")
      .argument("[slug]")
      .option("--project <slug>", "Project slug")
      .action(async function (this: Command, slug: string | undefined, opts: { project?: string }) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const data = await deps.apiRequest<any>(
            `/projects/${project}/resources/${resourceSlug}/history${flags.json ? buildQuery({ view: "raw" }) : ""}`,
            { token, apiUrl },
          );
          if (flags.json) return output(data, flags);
          deps.log(renderResourceHistoryTable(data as ResourceHistoryEntry[]));
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "history"],
  );

  return resourceCmd;
}

export const resourceCmd = createResourceCommand();
