import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { renderCommandHelp } from "@opsy/contracts";
import { createChangeCommand } from "./change";
import { createContextCommand } from "./context";
import { createFeedbackCommand } from "./feedback";
import { createIntegrationCommand } from "./integration";
import { createProjectCommand } from "./project";
import { createResourceCommand } from "./resource";
import { renderOperationDetail } from "../display";

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
    apiRequest: async () => ({}),
    apiStream: async function* () {},
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
    expect(help).toContain("2. `opsy project list`");
    expect(help).toContain("resource list --project <slug>` returns root resources first");
    expect(help).toContain("Use `opsy change create` for reviewable drafts");
    expect(help).toContain("`opsy resource forget`");
    expect(help).toContain("pass `--auto-apply` to apply immediately");
    expect(help).toContain("Use `--parent <slug>` on `resource create` and `resource update`");
    expect(help).toContain("Use `--depends-on <json>` on `resource create` and `resource update`");
    expect(help).toContain("project");
  });

  test("project list hits the projects endpoint", async () => {
    const requests: Array<{ path: string; method: string | undefined }> = [];
    const program = createProgram([createProjectCommand({
      ...createDeps(),
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts?.method });
        return [];
      },
    })]);

    await program.parseAsync(["node", "opsy", "project", "list"], { from: "node" });

    expect(requests).toEqual([{ path: "/projects", method: undefined }]);
  });

  test("project get and create use the projects endpoints", async () => {
    const requests: Array<{ path: string; method: string | undefined; body?: unknown }> = [];
    const program = createProgram([createProjectCommand({
      ...createDeps(),
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts?.method, body: opts?.body });
        return { slug: "acme", name: "Acme" };
      },
    })]);

    await program.parseAsync(["node", "opsy", "project", "get", "acme"], { from: "node" });
    await program.parseAsync(["node", "opsy", "project", "create", "--slug", "acme", "--name", "Acme"], { from: "node" });

    expect(requests).toEqual([
      { path: "/projects/acme", method: undefined, body: undefined },
      { path: "/projects", method: "POST", body: { slug: "acme", name: "Acme" } },
    ]);
  });

  test("resource list hits the resources endpoint", async () => {
    const requests: Array<{ path: string; method: string | undefined }> = [];
    const program = createProgram([createResourceCommand({
      ...createDeps(),
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts?.method });
        return [];
      },
    })]);

    await program.parseAsync(
      ["node", "opsy", "resource", "list", "--project", "acme"],
      { from: "node" },
    );

    expect(requests).toEqual([{ path: "/projects/acme/resources", method: undefined }]);
  });

  test("resource list renders parent and children columns", async () => {
    const logs: string[] = [];
    const program = createProgram([createResourceCommand({
      ...createDeps(),
      apiRequest: async () => ([
        {
          slug: "vpc",
          kind: "resource",
          type: "aws:ec2/vpc:Vpc",
          status: "live",
          parentSlug: null,
          childCount: 2,
          providerId: "vpc-123",
        },
      ]),
      log: (message?: string) => logs.push(String(message ?? "")),
    })]);

    await program.parseAsync(["node", "opsy", "resource", "list", "--project", "acme"], { from: "node" });

    const output = logs.join("\n");
    expect(output).toContain("PARENT");
    expect(output).toContain("CHILDREN");
    expect(output).toContain("vpc");
    expect(output).toContain("2");
  });

  test("resource list falls back to saved context", async () => {
    const requests: Array<{ path: string; method: string | undefined }> = [];
    const tempDir = mkdtempSync(join(tmpdir(), "opsy-cli-"));
    const configPath = join(tempDir, "config.json");
    const previousConfigPath = process.env.OPSY_CONFIG_PATH;
    writeFileSync(configPath, JSON.stringify({ project: "acme" }));
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
      expect(requests).toEqual([{ path: "/projects/acme/resources", method: undefined }]);
    } finally {
      if (previousConfigPath === undefined) delete process.env.OPSY_CONFIG_PATH;
      else process.env.OPSY_CONFIG_PATH = previousConfigPath;
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("integration get uses the integration endpoint", async () => {
    const requests: string[] = [];
    const program = createProgram([createIntegrationCommand({
      ...createDeps(),
      apiRequest: async (path: string) => {
        requests.push(path);
        return { id: "intg-1" };
      },
    })]);

    await program.parseAsync(["node", "opsy", "--json", "integration", "get", "intg-1"], { from: "node" });

    expect(requests).toEqual(["/integrations/intg-1"]);
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
        ["node", "opsy", "context", "use", "--project", "acme"],
        { from: "node" },
      );

      expect(JSON.parse(readFileSync(configPath, "utf8"))).toMatchObject({
        project: "acme",
      });

      await program.parseAsync(["node", "opsy", "context", "show"], { from: "node" });
      expect(printed.join("\n")).toContain("Project: acme");

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
      apiRequest: async (path: string) => {
        if (path === "/changes/abcd1234") {
          return {
            kind: "change.detail",
            change: {
              shortId: "abcd1234",
              status: "open",
              summary: null,
              createdAt: new Date().toISOString(),
              previewSummary: {},
              counts: { pending: 0, running: 0, failed: 0, blocked: 0, succeeded: 0 },
              warnings: [],
            },
            operations: [],
          };
        }
        return {
          kind: "approval_required",
          change: { shortId: "abcd1234", status: "open" },
          reviewUrl: "https://example.com/review",
        };
      },
      log: (message?: string) => logs.push(String(message ?? "")),
    })]);

    await program.parseAsync(["node", "opsy", "change", "apply", "abcd1234"], { from: "node" });

    expect(logs.join("\n")).toContain("Human approval required in the Opsy web UI");
    expect(logs.join("\n")).toContain("has not been applied yet");
    expect(logs.join("\n")).toContain("https://example.com/review");
  });

  test("change get prefers blocker text and keeps header spacing", async () => {
    const logs: string[] = [];
    const program = createProgram([createChangeCommand({
      ...createDeps(),
      apiRequest: async () => ({
        kind: "change.detail",
        change: {
          shortId: "abcd1234",
          status: "failed",
          summary: "Test change",
          createdAt: new Date().toISOString(),
          previewSummary: { delete: 1, read: 0 },
          counts: { pending: 0, running: 0, failed: 0, blocked: 1, succeeded: 1 },
          warnings: [],
        },
        operations: [
          {
            operationId: "op-1",
            slug: "bucket",
            kind: "delete",
            status: "blocked",
            resourceType: "aws:s3/bucket:Bucket",
            dependsOn: ["index"],
            changes: [],
            error: { message: "Step was blocked by a failed dependency." },
            blockedBy: ["index"],
          },
        ],
      }),
      log: (message?: string) => logs.push(String(message ?? "")),
    })]);

    await program.parseAsync(["node", "opsy", "change", "get", "abcd1234"], { from: "node" });

    const output = logs.join("\n");
    expect(output).toContain("Succeeded ");
    expect(output).toContain("blocked by: index");
    expect(output).toContain("depends on: index");
    expect(output).not.toContain("error: Step was blocked by a failed dependency.");
    expect(output).not.toContain("read:0");
  });

  test("resource create, update, and delete forward preview-first payloads", async () => {
    const requests: Array<{ path: string; method: string | undefined; body?: unknown }> = [];
    const program = createProgram([createResourceCommand({
      ...createDeps(),
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts?.method, body: opts?.body });
        return { change: { shortId: "abcd1234" } };
      },
    })]);

    await program.parseAsync([
      "node",
      "opsy",
      "--json",
      "resource",
      "create",
      "--project",
      "acme",
      "--slug",
      "policy",
      "--type",
      "aws:s3/bucketPolicy:BucketPolicy",
      "--inputs",
      '{"bucket":"demo"}',
      "--depends-on",
      '["public-access-block"]',
    ], { from: "node" });

    await program.parseAsync([
      "node",
      "opsy",
      "--json",
      "resource",
      "update",
      "policy",
      "--project",
      "acme",
      "--inputs",
      "{}",
      "--depends-on",
      '["public-access-block"]',
    ], { from: "node" });

    await program.parseAsync([
      "node",
      "opsy",
      "--json",
      "resource",
      "delete",
      "policy",
      "--project",
      "acme",
    ], { from: "node" });

    expect(requests[0]).toEqual({
      path: "/projects/acme/resources",
      method: "POST",
      body: {
        slug: "policy",
        type: "aws:s3/bucketPolicy:BucketPolicy",
        inputs: { bucket: "demo" },
        parent: undefined,
        dependsOn: ["public-access-block"],
        autoApply: undefined,
        summary: undefined,
      },
    });
    expect(requests[1]).toEqual({
      path: "/projects/acme/resources/policy",
      method: "PUT",
      body: {
        inputs: {},
        summary: undefined,
        removeInputPaths: undefined,
        parent: undefined,
        dependsOn: ["public-access-block"],
        autoApply: undefined,
        version: undefined,
      },
    });
    expect(requests[2]).toEqual({
      path: "/projects/acme/resources",
      method: "DELETE",
      body: {
        slug: "policy",
        recursive: undefined,
        autoApply: undefined,
      },
    });
  });

  test("resource create, update, and delete forward autoApply when requested", async () => {
    const requests: Array<{ path: string; method: string | undefined; body?: unknown }> = [];
    const program = createProgram([createResourceCommand({
      ...createDeps(),
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts?.method, body: opts?.body });
        return { change: { shortId: "abcd1234" } };
      },
    })]);

    await program.parseAsync([
      "node",
      "opsy",
      "--json",
      "resource",
      "create",
      "--project",
      "acme",
      "--slug",
      "policy",
      "--type",
      "aws:s3/bucketPolicy:BucketPolicy",
      "--inputs",
      '{"bucket":"demo"}',
      "--auto-apply",
    ], { from: "node" });

    await program.parseAsync([
      "node",
      "opsy",
      "--json",
      "resource",
      "update",
      "policy",
      "--project",
      "acme",
      "--inputs",
      "{}",
      "--auto-apply",
    ], { from: "node" });

    await program.parseAsync([
      "node",
      "opsy",
      "--json",
      "resource",
      "delete",
      "policy",
      "--project",
      "acme",
      "--auto-apply",
    ], { from: "node" });

    expect((requests[0].body as any).autoApply).toBe(true);
    expect((requests[1].body as any).autoApply).toBe(true);
    expect((requests[2].body as any).autoApply).toBe(true);
  });

  test("resource forget posts a forget mutation with targetDependents", async () => {
    const requests: Array<{ path: string; method: string | undefined; body?: unknown }> = [];
    const program = createProgram([createResourceCommand({
      ...createDeps(),
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts?.method, body: opts?.body });
        return { change: { shortId: "abcd1234" } };
      },
    })]);

    await program.parseAsync([
      "node",
      "opsy",
      "--json",
      "resource",
      "forget",
      "provider",
      "--project",
      "acme",
      "--recursive",
      "--target-dependents",
      "--summary",
      "Forget stale provider state",
    ], { from: "node" });

    expect(requests).toEqual([{
      path: "/projects/acme/changes",
      method: "POST",
      body: {
        mutations: [{
          kind: "forget",
          slug: "provider",
          recursive: true,
          targetDependents: true,
        }],
        summary: "Forget stale provider state",
      },
    }]);
  });

  test("change preview omits zero-count plan entries", async () => {
    const logs: string[] = [];
    const program = createProgram([createChangeCommand({
      ...createDeps(),
      apiRequest: async () => ({
        kind: "change.preview",
        change: {
          shortId: "abcd1234",
          status: "previewed",
          summary: "Preview change",
        },
        plan: { read: 0, same: 0, delete: 1, create: 0 },
        operations: [],
        impacts: [],
      }),
      log: (message?: string) => logs.push(String(message ?? "")),
    })]);

    await program.parseAsync(["node", "opsy", "change", "preview", "abcd1234"], { from: "node" });

    const output = logs.join("\n");
    expect(output).toContain("delete:1");
    expect(output).not.toContain("read:0");
    expect(output).not.toContain("same:0");
  });

  test("change apply prints a single applying header", async () => {
    const logs: string[] = [];
    const program = createProgram([createChangeCommand({
      ...createDeps(),
      apiRequest: async (path: string) => {
        if (path === "/changes/abcd1234") {
          return {
            kind: "change.detail",
            change: {
              shortId: "abcd1234",
              status: "open",
              summary: "Apply once",
              createdAt: new Date().toISOString(),
              previewSummary: {},
              counts: { pending: 1, running: 0, failed: 0, blocked: 0, succeeded: 0 },
              warnings: [],
            },
            operations: [
              {
                operationId: "op-1",
                slug: "bucket",
                kind: "create",
                status: "pending",
                resourceType: "aws:s3/bucket:Bucket",
                dependsOn: [],
                changes: [],
                error: null,
                blockedBy: [],
              },
            ],
          };
        }
        return {
          kind: "started",
          executionId: "exec-1",
          changeShortId: "abcd1234",
          targetSlugs: ["bucket"],
        };
      },
      apiStream: async function* () {
        yield {
          event: "step.started",
          data: JSON.stringify({
            id: "exec-1:1",
            executionId: "exec-1",
            changeId: "change-1",
            changeShortId: "abcd1234",
            projectSlug: "acme",
            sequence: 1,
            timestamp: new Date().toISOString(),
            type: "step.started",
            payload: { resourceSlug: "bucket", op: "create" },
          }),
        };
        yield {
          event: "step.completed",
          data: JSON.stringify({
            id: "exec-1:2",
            executionId: "exec-1",
            changeId: "change-1",
            changeShortId: "abcd1234",
            projectSlug: "acme",
            sequence: 2,
            timestamp: new Date().toISOString(),
            type: "step.completed",
            payload: { resourceSlug: "bucket", op: "create", status: "succeeded" },
          }),
        };
        yield {
          event: "execution.completed",
          data: JSON.stringify({
            id: "exec-1:3",
            executionId: "exec-1",
            changeId: "change-1",
            changeShortId: "abcd1234",
            projectSlug: "acme",
            sequence: 3,
            timestamp: new Date().toISOString(),
            type: "execution.completed",
            payload: { status: "succeeded" },
          }),
        };
      },
      log: (message?: string) => logs.push(String(message ?? "")),
    })]);

    await program.parseAsync(["node", "opsy", "change", "apply", "abcd1234"], { from: "node" });

    expect(logs.join("\n").match(/Applying\s+abcd1234/g) ?? []).toHaveLength(1);
  });

  test("resource diff shows the ID and suppresses phantom root rows", async () => {
    const logs: string[] = [];
    const program = createProgram([createResourceCommand({
      ...createDeps(),
      apiRequest: async () => ({
        kind: "resource.diff",
        resource: {
          slug: "bucket",
          type: "aws:s3/bucket:Bucket",
          status: "out_of_sync",
          providerId: "bucket-123",
        },
        delta: [
          { path: "forceDestroy", before: true, after: null },
        ],
        outcome: null,
      }),
      log: (message?: string) => logs.push(String(message ?? "")),
    })]);

    await program.parseAsync(["node", "opsy", "resource", "diff", "bucket", "--project", "acme"], { from: "node" });

    const output = logs.join("\n");
    expect(output).toContain("ID        bucket-123");
    expect(output).toContain("forceDestroy: true -> -");
    expect(output).not.toContain("(value)");
  });

  test("resource get renders dependsOn when present", async () => {
    const logs: string[] = [];
    const program = createProgram([createResourceCommand({
      ...createDeps(),
      apiRequest: async () => ({
        kind: "resource.detail",
        resource: {
          slug: "policy",
          type: "aws:s3/bucketPolicy:BucketPolicy",
          status: "live",
          syncState: "in_sync",
          providerId: null,
          dependsOn: ["public-access-block"],
        },
        intent: [],
        problem: [],
        outcome: null,
      }),
      log: (message?: string) => logs.push(String(message ?? "")),
    })]);

    await program.parseAsync(["node", "opsy", "resource", "get", "policy", "--project", "acme"], { from: "node" });

    expect(logs.join("\n")).toContain("DependsOn public-access-block");
  });

  test("operation detail renderer includes dependency metadata", () => {
    const output = renderOperationDetail({
      kind: "operation.detail",
      operation: {
        id: "op-1",
        slug: "policy",
        kind: "update",
        status: "queued",
        changeShortId: "abcd1234",
        resourceType: "aws:s3/bucketPolicy:BucketPolicy",
        dependsOn: ["public-access-block"],
      },
      intent: [],
      outcome: {
        startedAt: null,
        finishedAt: null,
        result: "queued",
      },
      failure: null,
      blocker: null,
      diff: [],
      timeline: [],
      advanced: {},
    });

    expect(output).toContain("DependsOn public-access-block");
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
      program.parseAsync(["node", "opsy", "list", "resources", "--project", "acme"], { from: "node" }),
    ).rejects.toThrow();
  });
});
