import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { createDiscoveryCommand, formatSupportedDiscoveryProviders } from "./discovery";

function createProgram(command = createDiscoveryCommand({
  apiRequest: async (path: string) => {
    if (path.includes("/types")) return [{ providerType: "s3:bucket", pulumiType: "aws:s3/bucket:Bucket" }];
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

describe("discovery CLI command", () => {
  test("formats supported providers", () => {
    expect(formatSupportedDiscoveryProviders()).toContain("aws");
    expect(formatSupportedDiscoveryProviders()).toContain("cloudflare");
  });

  test("top-level discovery prints supported providers", async () => {
    const logs: string[] = [];
    const program = createProgram(createDiscoveryCommand({
      apiRequest: async () => [],
      getToken: () => "test-token",
      getApiUrl: () => "http://localhost:4000",
      log: (message) => logs.push(String(message ?? "")),
      error: () => {},
      exit: ((code: number) => {
        throw new Error(`exit:${code}`);
      }) as any,
    }));

    await program.parseAsync(["node", "opsy", "discovery"], { from: "node" });
    expect(logs.join("\n")).toContain("Supported discovery providers");
    expect(logs.join("\n")).toContain("aws");
    expect(logs.join("\n")).toContain("cloudflare");
  });

  test("discovery aws types hits the provider-scoped route", async () => {
    const paths: string[] = [];
    const program = createProgram(createDiscoveryCommand({
      apiRequest: async (path: string) => {
        paths.push(path);
        return [{ providerType: "s3:bucket", pulumiType: "aws:s3/bucket:Bucket" }];
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
      ["node", "opsy", "discovery", "aws", "types", "--workspace", "acme", "--env", "prod", "--query", "s3"],
      { from: "node" },
    );

    expect(paths).toEqual(["/workspaces/acme/environments/prod/discover/aws/types?query=s3"]);
  });

  test("discovery cloudflare list hits the provider-scoped route", async () => {
    const paths: string[] = [];
    const program = createProgram(createDiscoveryCommand({
      apiRequest: async (path: string) => {
        paths.push(path);
        return [];
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
      ["node", "opsy", "discovery", "cloudflare", "list", "--workspace", "acme", "--env", "prod", "--type", "zone"],
      { from: "node" },
    );

    expect(paths).toEqual(["/workspaces/acme/environments/prod/discover/cloudflare?type=zone"]);
  });

  test("discovery uses context defaults when workspace and env are omitted", async () => {
    const paths: string[] = [];
    const previousWorkspace = process.env.OPSY_WORKSPACE;
    const previousEnv = process.env.OPSY_ENV;
    process.env.OPSY_WORKSPACE = "acme";
    process.env.OPSY_ENV = "prod";

    try {
      const program = createProgram(createDiscoveryCommand({
        apiRequest: async (path: string) => {
          paths.push(path);
          return [];
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
        ["node", "opsy", "discovery", "cloudflare", "list", "--type", "zone"],
        { from: "node" },
      );

      expect(paths).toEqual(["/workspaces/acme/environments/prod/discover/cloudflare?type=zone"]);
    } finally {
      if (previousWorkspace === undefined) delete process.env.OPSY_WORKSPACE;
      else process.env.OPSY_WORKSPACE = previousWorkspace;
      if (previousEnv === undefined) delete process.env.OPSY_ENV;
      else process.env.OPSY_ENV = previousEnv;
    }
  });
});
