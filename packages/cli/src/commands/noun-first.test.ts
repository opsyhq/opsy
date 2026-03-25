import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { renderCommandHelp } from "@opsy/contracts";
import { createChangeCommand } from "./change";
import { createContextCommand } from "./context";
import { createEnvironmentCommand } from "./environment";
import { createFeedbackCommand } from "./feedback";
import { createProviderCommand } from "./provider";
import { createResourceCommand } from "./resource";
import { createWorkspaceCommand } from "./workspace";

function createProgram(commands: Command[]) {
  const program = new Command();
  program
    .name("opsy")
    .option("--token <pat>")
    .option("--api-url <url>")
    .option("--json")
    .option("--quiet")
    .exitOverride()
    .configureHelp({
      formatHelp: () => renderCommandHelp([]),
    });
  for (const command of commands) {
    program.addCommand(command);
  }
  return program;
}

function createDeps() {
  return {
    getToken: () => "test-token",
    getApiUrl: () => "http://localhost:4000",
    log: () => {},
    error: () => {},
    exit: ((code: number) => {
      throw new Error(`exit:${code}`);
    }) as any,
  };
}

describe("noun-first CLI surface", () => {
  test("top-level help shows the zero-start workflow", () => {
    const program = createProgram([]);
    const help = program.helpInformation();

    expect(help).toContain("1. `opsy auth login --token <pat>`");
    expect(help).toContain("2. `opsy workspace list`");
    expect(help).toContain("resource list --workspace <slug> --env <slug>` returns root resources first");
    expect(help).toContain("Use `opsy change create` for reviewable drafts");
    expect(help).toContain("Use `--parent <slug>` on `resource create` and `resource update`");
    expect(help).toContain("workspace");
  });

  test("workspace list hits the existing workspaces endpoint", async () => {
    const requests: Array<{ path: string; method: string | undefined }> = [];
    const program = createProgram([createWorkspaceCommand({
      ...createDeps(),
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts?.method });
        return [];
      },
    })]);

    await program.parseAsync(["node", "opsy", "workspace", "list"], { from: "node" });

    expect(requests).toEqual([{ path: "/workspaces", method: undefined }]);
  });

  test("workspace get and create use the existing workspaces endpoints", async () => {
    const requests: Array<{ path: string; method: string | undefined; body?: unknown }> = [];
    const program = createProgram([createWorkspaceCommand({
      ...createDeps(),
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts?.method, body: opts?.body });
        return { slug: "acme", name: "Acme" };
      },
    })]);

    await program.parseAsync(["node", "opsy", "workspace", "get", "acme"], { from: "node" });
    await program.parseAsync(["node", "opsy", "workspace", "create", "--slug", "acme", "--name", "Acme"], { from: "node" });

    expect(requests).toEqual([
      { path: "/workspaces/acme", method: undefined, body: undefined },
      { path: "/workspaces", method: "POST", body: { slug: "acme", name: "Acme" } },
    ]);
  });

  test("resource list hits the existing resources endpoint", async () => {
    const requests: Array<{ path: string; method: string | undefined }> = [];
    const program = createProgram([createResourceCommand({
      ...createDeps(),
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts?.method });
        return [];
      },
    })]);

    await program.parseAsync(
      ["node", "opsy", "resource", "list", "--workspace", "acme", "--env", "prod"],
      { from: "node" },
    );

    expect(requests).toEqual([{ path: "/workspaces/acme/environments/prod/resources", method: undefined }]);
  });

  test("resource list falls back to saved context", async () => {
    const requests: Array<{ path: string; method: string | undefined }> = [];
    const tempDir = mkdtempSync(join(tmpdir(), "opsy-cli-"));
    const configPath = join(tempDir, "config.json");
    const previousConfigPath = process.env.OPSY_CONFIG_PATH;
    writeFileSync(configPath, JSON.stringify({ workspace: "acme", env: "prod" }));
    process.env.OPSY_CONFIG_PATH = configPath;

    try {
      const program = createProgram([createResourceCommand({
        ...createDeps(),
        apiRequest: async (path: string, opts: any) => {
          requests.push({ path, method: opts?.method });
          return [];
        },
      })]);

      await program.parseAsync(["node", "opsy", "resource", "list"], { from: "node" });
      expect(requests).toEqual([{ path: "/workspaces/acme/environments/prod/resources", method: undefined }]);
    } finally {
      if (previousConfigPath === undefined) delete process.env.OPSY_CONFIG_PATH;
      else process.env.OPSY_CONFIG_PATH = previousConfigPath;
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("provider get uses the provider endpoint", async () => {
    const requests: string[] = [];
    const program = createProgram([createProviderCommand({
      ...createDeps(),
      apiRequest: async (path: string) => {
        requests.push(path);
        return { id: "prov-1" };
      },
    })]);

    await program.parseAsync(["node", "opsy", "--json", "provider", "get", "prov-1"], { from: "node" });

    expect(requests).toEqual(["/providers/prov-1"]);
  });

  test("environment provider add uses the env provider endpoint", async () => {
    const requests: Array<{ path: string; method: string | undefined; body?: unknown }> = [];
    const program = createProgram([createEnvironmentCommand({
      ...createDeps(),
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts?.method, body: opts?.body });
        return { providerProfile: { id: "prov-1" } };
      },
    })]);

    await program.parseAsync([
      "node",
      "opsy",
      "environment",
      "provider",
      "add",
      "--workspace",
      "acme",
      "--env",
      "prod",
      "--provider",
      "aws",
      "--name",
      "main",
      "--config",
      '{"AWS_REGION":"us-east-1"}',
    ], { from: "node" });

    expect(requests).toEqual([{
      path: "/workspaces/acme/environments/prod/providers",
      method: "POST",
      body: {
        providerPkg: "aws",
        profileName: "main",
        config: { AWS_REGION: "us-east-1" },
      },
    }]);
  });

  test("environment provider attach uses the env provider endpoint", async () => {
    const requests: Array<{ path: string; method: string | undefined; body?: unknown }> = [];
    const program = createProgram([createEnvironmentCommand({
      ...createDeps(),
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts?.method, body: opts?.body });
        return { profileId: "prov-1" };
      },
    })]);

    await program.parseAsync([
      "node",
      "opsy",
      "environment",
      "provider",
      "attach",
      "--workspace",
      "acme",
      "--env",
      "prod",
      "--profile",
      "prov-1",
    ], { from: "node" });

    expect(requests).toEqual([{
      path: "/workspaces/acme/environments/prod/providers",
      method: "POST",
      body: { profileId: "prov-1" },
    }]);
  });

  test("environment provider list uses the env provider endpoint", async () => {
    const requests: Array<{ path: string; method: string | undefined }> = [];
    const program = createProgram([createEnvironmentCommand({
      ...createDeps(),
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts?.method });
        return [];
      },
    })]);

    await program.parseAsync([
      "node",
      "opsy",
      "environment",
      "provider",
      "list",
      "--workspace",
      "acme",
      "--env",
      "prod",
    ], { from: "node" });

    expect(requests).toEqual([{ path: "/workspaces/acme/environments/prod/providers", method: undefined }]);
  });

  test("context use, show, and clear manage saved scope", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "opsy-context-"));
    const configPath = join(tempDir, "config.json");
    const previousConfigPath = process.env.OPSY_CONFIG_PATH;
    const originalConsoleLog = console.log;
    const printed: string[] = [];
    process.env.OPSY_CONFIG_PATH = configPath;
    console.log = (message?: unknown) => {
      printed.push(String(message ?? ""));
    };

    try {
      const program = createProgram([createContextCommand()]);
      await program.parseAsync(
        ["node", "opsy", "context", "use", "--workspace", "acme", "--env", "prod"],
        { from: "node" },
      );

      expect(JSON.parse(readFileSync(configPath, "utf8"))).toMatchObject({
        workspace: "acme",
        env: "prod",
      });

      await program.parseAsync(["node", "opsy", "context", "show"], { from: "node" });
      expect(printed.join("\n")).toContain("Workspace: acme");
      expect(printed.join("\n")).toContain("Env: prod");

      await program.parseAsync(["node", "opsy", "context", "clear"], { from: "node" });
      expect(JSON.parse(readFileSync(configPath, "utf8"))).toEqual({});
    } finally {
      console.log = originalConsoleLog;
      if (previousConfigPath === undefined) delete process.env.OPSY_CONFIG_PATH;
      else process.env.OPSY_CONFIG_PATH = previousConfigPath;
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("change apply prints approval guidance when blocked", async () => {
    const logs: string[] = [];
    const program = createProgram([createChangeCommand({
      ...createDeps(),
      apiRequest: async () => ({
        approvalRequired: true,
        autoApply: false,
        reviewUrl: "https://example.com/review",
        change: { shortId: "abcd1234", status: "open" },
      }),
      log: (message?: string) => logs.push(String(message ?? "")),
    })]);

    await program.parseAsync(["node", "opsy", "change", "apply", "abcd1234"], { from: "node" });

    expect(logs.join("\n")).toContain("Human approval required in the Opsy web UI");
    expect(logs.join("\n")).toContain("has not been applied yet");
    expect(logs.join("\n")).toContain("https://example.com/review");
  });

  test("feedback send forwards error context and llm source", async () => {
    const bodies: unknown[] = [];
    const program = createProgram([createFeedbackCommand({
      ...createDeps(),
      apiRequest: async (_path: string, opts: any) => {
        bodies.push(opts.body);
        return { id: "fb-1" };
      },
    })]);

    await program.parseAsync([
      "node",
      "opsy",
      "feedback",
      "send",
      "--message",
      "broken",
      "--error-context",
      '{"error":"boom"}',
      "--from-llm",
    ], { from: "node" });

    expect(bodies).toEqual([{
      message: "broken",
      source: "cli_llm",
      metadata: { errorContext: { error: "boom" } },
    }]);
  });

  test("old verb-first invocations fail", async () => {
    const program = createProgram([createResourceCommand({
      ...createDeps(),
      apiRequest: async () => [],
    })]);

    await expect(
      program.parseAsync(["node", "opsy", "list", "resources", "--workspace", "acme", "--env", "prod"], { from: "node" }),
    ).rejects.toThrow();
  });
});
