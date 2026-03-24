import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { renderCommandHelp } from "@opsy/contracts";
import { createChangeCommand } from "./change";
import { createFeedbackCommand } from "./feedback";
import { createProviderCommand } from "./provider";
import { createResourceCommand } from "./resource";

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
  test("top-level help shows noun-first commands", () => {
    const program = createProgram([]);
    expect(program.helpInformation()).toContain("Core nouns:");
    expect(program.helpInformation()).toContain("resource");
    expect(program.helpInformation()).toContain("observability aws");
    expect(program.helpInformation()).not.toContain("Core verbs:");
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

    expect(logs.join("\n")).toContain("Manual approval required");
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
