import { Command } from "commander";
import {
  addSharedHelp,
  defaultCliDeps,
  getRootFlags,
  handleCliError,
  parseJsonFlag,
  requireArgumentValue,
  requireEnvValue,
  requireOptionValue,
  requireWorkspaceValue,
  type CliDeps,
} from "./common";
import { formatTable, output } from "../output";

export function createEnvironmentCommand(deps: CliDeps = defaultCliDeps) {
  const environmentCmd = new Command("environment").description("List, get, and create environments");

  addSharedHelp(
    environmentCmd.command("list")
      .description("List environments")
      .option("--workspace <slug>", "Workspace slug")
      .action(async function (this: Command, opts: { workspace?: string }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireWorkspaceValue(this, opts.workspace);
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const envs = await deps.apiRequest<any[]>(`/workspaces/${workspace}/environments`, { token, apiUrl });
          if (flags.json) return output(envs, flags);
          if (!envs.length) return deps.log("No environments found.");
          deps.log(formatTable(
            ["SLUG", "AUTO-APPLY", "CREATED"],
            envs.map((env) => [env.slug, env.autoApplyPolicy ?? "disabled", new Date(env.createdAt).toLocaleDateString()]),
          ));
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["environment", "list"],
  );

  addSharedHelp(
    environmentCmd.command("get")
      .description("Get one environment")
      .argument("[slug]")
      .option("--workspace <slug>", "Workspace slug")
      .action(async function (this: Command, slug: string | undefined, opts: { workspace?: string }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireWorkspaceValue(this, opts.workspace);
          const envSlug = requireArgumentValue(slug, "environment slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(
            `/workspaces/${workspace}/environments/${envSlug}`,
            { token, apiUrl },
          ), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["environment", "get"],
  );

  addSharedHelp(
    environmentCmd.command("create")
      .description("Create an environment")
      .option("--workspace <slug>", "Workspace slug")
      .option("--slug <slug>", "Environment slug")
      .action(async function (this: Command, opts: { workspace?: string; slug?: string }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireWorkspaceValue(this, opts.workspace);
          const slug = requireOptionValue(opts.slug, "slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(`/workspaces/${workspace}/environments`, {
            method: "POST",
            body: { slug },
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["environment", "create"],
  );

  const environmentProviderCmd = new Command("provider").description("Manage provider bindings for an environment");

  environmentProviderCmd.command("list")
    .description("List providers bound to an environment")
    .option("--workspace <slug>", "Workspace slug")
    .option("--env <slug>", "Environment slug")
    .action(async function (this: Command, opts: { workspace?: string; env?: string }) {
      const flags = getRootFlags(this);
      try {
        const workspace = requireWorkspaceValue(this, opts.workspace);
        const env = requireEnvValue(this, opts.env);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        const providers = await deps.apiRequest<any[]>(`/workspaces/${workspace}/environments/${env}/providers`, { token, apiUrl });
        if (flags.json) return output(providers, flags);
        if (!providers.length) return deps.log("No providers bound to this environment.");
        deps.log(formatTable(
          ["PROFILE ID", "PROVIDER", "PROFILE", "BOUND"],
          providers.map((provider) => [
            provider.profileId.slice(0, 8),
            provider.providerPkg,
            provider.profileName,
            new Date(provider.boundAt).toLocaleDateString(),
          ]),
        ));
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  environmentProviderCmd.command("attach")
    .description("Attach an existing provider profile to an environment")
    .requiredOption("--profile <id>", "Provider profile ID")
    .option("--workspace <slug>", "Workspace slug")
    .option("--env <slug>", "Environment slug")
    .action(async function (this: Command, opts: { profile: string; workspace?: string; env?: string }) {
      const flags = getRootFlags(this);
      try {
        const workspace = requireWorkspaceValue(this, opts.workspace);
        const env = requireEnvValue(this, opts.env);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        const result = await deps.apiRequest<any>(`/workspaces/${workspace}/environments/${env}/providers`, {
          method: "POST",
          body: { profileId: opts.profile },
          token,
          apiUrl,
        });
        if (flags.json) return output(result, flags);
        deps.log(`Provider profile ${opts.profile} attached to ${workspace}/${env}.`);
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  environmentProviderCmd.command("add")
    .description("Create a provider profile and bind it to an environment")
    .requiredOption("--provider <pkg>", "Provider package")
    .requiredOption("--name <name>", "Profile name")
    .requiredOption("--config <json>", "Provider config JSON")
    .option("--workspace <slug>", "Workspace slug")
    .option("--env <slug>", "Environment slug")
    .action(async function (
      this: Command,
      opts: { provider: string; name: string; config: string; workspace?: string; env?: string },
    ) {
      const flags = getRootFlags(this);
      try {
        const workspace = requireWorkspaceValue(this, opts.workspace);
        const env = requireEnvValue(this, opts.env);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        const result = await deps.apiRequest<any>(`/workspaces/${workspace}/environments/${env}/providers`, {
          method: "POST",
          body: {
            providerPkg: opts.provider,
            profileName: opts.name,
            config: parseJsonFlag(opts.config, "config"),
          },
          token,
          apiUrl,
        });
        if (flags.json) return output(result, flags);
        deps.log(`Provider profile ${result.providerProfile.id} created and bound to ${workspace}/${env}.`);
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  environmentCmd.addCommand(environmentProviderCmd);

  return environmentCmd;
}

export const environmentCmd = createEnvironmentCommand();
