import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { renderCommandHelp } from "@opsy/contracts";
import { createApplyCommand } from "./apply";
import { createFeedbackCommand } from "./feedback";
import { createGetCommand } from "./get";
import { createListCommand } from "./list";

function createProgram(commands: Command[]) {
  const program = new Command();
  program
    .name("opsy")
    .option("--token <pat>")
    .option("--api-url <url>")
    .option("--json")
    .option("--quiet")
    .configureHelp({
      formatHelp: () => renderCommandHelp([]),
    });
  for (const command of commands) {
    program.addCommand(command);
  }
  return program;
}

describe("verb-first CLI surface", () => {
  test("top-level help shows verb-first commands", () => {
    const program = createProgram([]);
    expect(program.helpInformation()).toContain("Core verbs:");
    expect(program.helpInformation()).toContain("list");
    expect(program.helpInformation()).toContain("observe aws");
  });

  test("list resources hits the verb-first path", async () => {
    const requests: Array<{ path: string; method: string | undefined }> = [];
    const program = createProgram([createListCommand({
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts?.method });
        return [];
      },
      getToken: () => "test-token",
      getApiUrl: () => "http://localhost:4000",
      log: () => {},
      error: () => {},
      exit: ((code: number) => { throw new Error(`exit:${code}`); }) as any,
    })]);

    await program.parseAsync(
      ["node", "opsy", "list", "resources", "--workspace", "acme", "--env", "prod"],
      { from: "node" },
    );

    expect(requests).toEqual([{ path: "/workspaces/acme/environments/prod/resources", method: undefined }]);
  });

  test("get provider uses the new provider endpoint", async () => {
    const requests: string[] = [];
    const program = createProgram([createGetCommand({
      apiRequest: async (path: string) => {
        requests.push(path);
        return { id: "prov-1" };
      },
      getToken: () => "test-token",
      getApiUrl: () => "http://localhost:4000",
      log: () => {},
      error: () => {},
      exit: ((code: number) => { throw new Error(`exit:${code}`); }) as any,
    })]);

    await program.parseAsync(["node", "opsy", "--json", "get", "provider", "prov-1"], { from: "node" });

    expect(requests).toEqual(["/providers/prov-1"]);
  });

  test("apply change prints approval guidance when blocked", async () => {
    const logs: string[] = [];
    const program = createProgram([createApplyCommand({
      apiRequest: async () => ({
        approvalRequired: true,
        autoApply: false,
        reviewUrl: "https://example.com/review",
        change: { shortId: "abcd1234", status: "open" },
      }),
      getToken: () => "test-token",
      getApiUrl: () => "http://localhost:4000",
      log: (message?: string) => logs.push(String(message ?? "")),
      error: () => {},
      exit: ((code: number) => { throw new Error(`exit:${code}`); }) as any,
    })]);

    await program.parseAsync(["node", "opsy", "apply", "change", "abcd1234"], { from: "node" });

    expect(logs.join("\n")).toContain("Manual approval required");
    expect(logs.join("\n")).toContain("https://example.com/review");
  });

  test("feedback send forwards error context and llm source", async () => {
    const bodies: unknown[] = [];
    const program = createProgram([createFeedbackCommand({
      apiRequest: async (_path: string, opts: any) => {
        bodies.push(opts.body);
        return { id: "fb-1" };
      },
      getToken: () => "test-token",
      getApiUrl: () => "http://localhost:4000",
      log: () => {},
      error: () => {},
      exit: ((code: number) => { throw new Error(`exit:${code}`); }) as any,
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
});
