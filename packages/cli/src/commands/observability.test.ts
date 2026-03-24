import { afterEach, describe, expect, test } from "bun:test";
import { Command } from "commander";
import { ApiRequestError } from "../client";
import { createObservabilityCommand } from "./observability";

function createProgram(command = createObservabilityCommand({
  apiRequest: async () => ({}),
  getToken: () => "test-token",
  getApiUrl: () => "http://localhost:4000",
  log: () => {},
  error: () => {},
  exit: ((code: number) => {
    throw new Error(`exit:${code}`);
  }) as any,
})) {
  const program = new Command();
  program
    .name("opsy")
    .option("--token <pat>")
    .option("--api-url <url>")
    .option("--json")
    .option("--quiet");
  program.addCommand(command);
  return program;
}

describe("observability CLI command", () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  test("top-level observability prints supported providers", async () => {
    const logs: string[] = [];
    const program = createProgram(createObservabilityCommand({
      apiRequest: async () => ({}),
      getToken: () => "test-token",
      getApiUrl: () => "http://localhost:4000",
      log: (message) => logs.push(String(message ?? "")),
      error: () => {},
      exit: ((code: number) => {
        throw new Error(`exit:${code}`);
      }) as any,
    }));

    await program.parseAsync(["node", "opsy", "observability"], { from: "node" });
    expect(logs.join("\n")).toContain("Supported observability providers");
    expect(logs.join("\n")).toContain("aws");
  });

  test("logs groups hits the expected REST path", async () => {
    const paths: string[] = [];
    const program = createProgram(createObservabilityCommand({
      apiRequest: async (path: string) => {
        paths.push(path);
        return { items: [] };
      },
      getToken: () => "test-token",
      getApiUrl: () => "http://localhost:4000",
      log: () => {},
      error: () => {},
      exit: ((code: number) => {
        throw new Error(`exit:${code}`);
      }) as any,
    }));

    await program.parseAsync(
      ["node", "opsy", "observability", "aws", "logs", "groups", "--workspace", "acme", "--env", "prod", "--name-prefix", "/aws/lambda/"],
      { from: "node" },
    );

    expect(paths).toEqual([
      "/workspaces/acme/environments/prod/observe/aws/logs/groups?namePrefix=%2Faws%2Flambda%2F",
    ]);
  });

  test("metrics query posts the expected body", async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    const program = createProgram(createObservabilityCommand({
      apiRequest: async (path: string, opts: any) => {
        calls.push({ path, body: opts.body });
        return { results: [] };
      },
      getToken: () => "test-token",
      getApiUrl: () => "http://localhost:4000",
      log: () => {},
      error: () => {},
      exit: ((code: number) => {
        throw new Error(`exit:${code}`);
      }) as any,
    }));

    await program.parseAsync(
      ["node", "opsy", "observability", "aws", "metrics", "query", "--workspace", "acme", "--env", "prod", "--queries", "[{\"Id\":\"cpu\"}]"],
      { from: "node" },
    );

    expect(calls).toEqual([{
      path: "/workspaces/acme/environments/prod/observe/aws/metrics/query",
      body: {
        profileId: undefined,
        region: undefined,
        queries: [{ Id: "cpu" }],
        since: undefined,
        until: undefined,
        scanBy: undefined,
        maxDatapoints: undefined,
      },
    }]);
  });

  test("--json prints the raw response payload", async () => {
    const printed: string[] = [];
    console.log = (message?: unknown) => {
      printed.push(String(message ?? ""));
    };

    const program = createProgram(createObservabilityCommand({
      apiRequest: async () => ({ provider: "aws", items: [{ name: "/aws/lambda/app" }] }),
      getToken: () => "test-token",
      getApiUrl: () => "http://localhost:4000",
      log: () => {},
      error: () => {},
      exit: ((code: number) => {
        throw new Error(`exit:${code}`);
      }) as any,
    }));

    await program.parseAsync(
      ["node", "opsy", "--json", "observability", "aws", "logs", "groups", "--workspace", "acme", "--env", "prod"],
      { from: "node" },
    );

    expect(printed.join("\n")).toContain('"provider": "aws"');
    expect(printed.join("\n")).toContain('"/aws/lambda/app"');
  });

  test("help text comes from the shared catalog", () => {
    const command = createObservabilityCommand();
    const aws = command.commands.find((entry) => entry.name() === "aws");
    const logs = aws?.commands.find((entry) => entry.name() === "logs");
    const groups = logs?.commands.find((entry) => entry.name() === "groups");
    let written = "";
    groups?.configureOutput({
      writeOut: (value) => {
        written += value;
      },
      writeErr: (value) => {
        written += value;
      },
    });
    groups?.outputHelp();
    expect(written).toContain("observability aws logs groups");
    expect(written).toContain("Examples:");
  });

  test("logs query surfaces timeout guidance in stderr", async () => {
    const errors: string[] = [];
    const program = createProgram(createObservabilityCommand({
      apiRequest: async () => {
        throw new ApiRequestError(400, {
          isError: true,
          code: "VALIDATION_ERROR",
          message: "CloudWatch Logs query timed out after 15s. Last status: Running. Narrow the range or retry.",
          details: {
            kind: "query_timeout",
            queryId: "query-1",
            status: "Running",
            retryHint: "Narrow the time range or retry the query.",
          },
        });
      },
      getToken: () => "test-token",
      getApiUrl: () => "http://localhost:4000",
      log: () => {},
      error: (message) => errors.push(String(message ?? "")),
      exit: ((code: number) => {
        throw new Error(`exit:${code}`);
      }) as any,
    }));

    await expect(program.parseAsync(
      ["node", "opsy", "observability", "aws", "logs", "query", "--workspace", "acme", "--env", "prod", "--log-groups", "/aws/lambda/app", "--query-string", "fields @message"],
      { from: "node" },
    )).rejects.toThrow("exit:1");

    expect(errors.join("\n")).toContain("Query ID: query-1");
    expect(errors.join("\n")).toContain("Last status: Running");
    expect(errors.join("\n")).toContain("Retry hint: Narrow the time range or retry the query.");
  });

  test("--json prints structured error payloads", async () => {
    const printed: string[] = [];
    console.log = (message?: unknown) => {
      printed.push(String(message ?? ""));
    };

    const program = createProgram(createObservabilityCommand({
      apiRequest: async () => {
        throw new ApiRequestError(400, {
          isError: true,
          code: "VALIDATION_ERROR",
          message: "CloudWatch Logs query timed out after 15s. Last status: Running. Narrow the range or retry.",
          details: {
            kind: "query_timeout",
            queryId: "query-1",
            status: "Running",
            retryHint: "Narrow the time range or retry the query.",
          },
        });
      },
      getToken: () => "test-token",
      getApiUrl: () => "http://localhost:4000",
      log: () => {},
      error: () => {},
      exit: ((code: number) => {
        throw new Error(`exit:${code}`);
      }) as any,
    }));

    await expect(program.parseAsync(
      ["node", "opsy", "--json", "observability", "aws", "logs", "query", "--workspace", "acme", "--env", "prod", "--log-groups", "/aws/lambda/app", "--query-string", "fields @message"],
      { from: "node" },
    )).rejects.toThrow("exit:1");

    expect(printed.join("\n")).toContain('"queryId": "query-1"');
    expect(printed.join("\n")).toContain('"retryHint": "Narrow the time range or retry the query."');
  });
});
