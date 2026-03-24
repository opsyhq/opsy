import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { createDiscoverCommand, formatSupportedDiscoveryProviders } from "./discover";

function createProgram(command = createDiscoverCommand({
  apiRequest: async (path: string) => {
    if (path.includes("/types")) return [{ reType: "s3:bucket", pulumiType: "aws:s3/bucket:Bucket" }];
    return [];
  },
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

describe("discover CLI command", () => {
  test("formats supported providers", () => {
    expect(formatSupportedDiscoveryProviders()).toContain("aws");
  });

  test("top-level discover prints supported providers", async () => {
    const logs: string[] = [];
    const program = createProgram(createDiscoverCommand({
      apiRequest: async () => [],
      getToken: () => "test-token",
      getApiUrl: () => "http://localhost:4000",
      log: (message) => logs.push(String(message ?? "")),
      error: () => {},
      exit: ((code: number) => {
        throw new Error(`exit:${code}`);
      }) as any,
    }));

    await program.parseAsync(["node", "opsy", "discover"], { from: "node" });
    expect(logs.join("\n")).toContain("Supported discovery providers");
    expect(logs.join("\n")).toContain("aws");
  });

  test("discover aws types hits the provider-scoped route", async () => {
    const paths: string[] = [];
    const program = createProgram(createDiscoverCommand({
      apiRequest: async (path: string) => {
        paths.push(path);
        return [{ reType: "s3:bucket", pulumiType: "aws:s3/bucket:Bucket" }];
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
      ["node", "opsy", "discover", "aws", "types", "--workspace", "acme", "--env", "prod", "--query", "s3"],
      { from: "node" },
    );

    expect(paths).toEqual(["/workspaces/acme/environments/prod/discover/aws/types?query=s3"]);
  });

  test("unsupported providers fail with manual-import guidance", async () => {
    const errors: string[] = [];
    const program = createProgram(createDiscoverCommand({
      apiRequest: async () => [],
      getToken: () => "test-token",
      getApiUrl: () => "http://localhost:4000",
      log: () => {},
      error: (message) => errors.push(String(message ?? "")),
      exit: ((code: number) => {
        throw new Error(`exit:${code}`);
      }) as any,
    }));

    await expect(
      program.parseAsync(["node", "opsy", "discover", "cloudflare", "list"], { from: "node" }),
    ).rejects.toThrow("exit:1");

    expect(errors[0]).toContain('Discovery is not implemented for "cloudflare". Use manual import.');
  });
});
