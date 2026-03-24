import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { createSchemaCommand } from "./schema";

function createProgram(command = createSchemaCommand({
  apiRequest: async (path: string) => {
    if (path.startsWith("/schemas/types")) {
      return {
        provider: "cloudflare",
        types: [{ token: "cloudflare:index/zone:Zone", name: "Zone" }],
      };
    }
    return {
      token: "cloudflare:index/zone:Zone",
      inputs: { account: "string" },
      outputs: { id: "string" },
    };
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

describe("schema CLI command", () => {
  test("schema list supports cloudflare providers", async () => {
    const paths: string[] = [];
    const program = createProgram(createSchemaCommand({
      apiRequest: async (path: string) => {
        paths.push(path);
        return {
          provider: "cloudflare",
          types: [{ token: "cloudflare:index/zone:Zone", name: "Zone" }],
        };
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
      ["node", "opsy", "schema", "list", "--provider", "cloudflare", "--query", "zone"],
      { from: "node" },
    );

    expect(paths).toEqual(["/schemas/types?provider=cloudflare&query=zone"]);
  });

  test("schema get uses the describe query route", async () => {
    const paths: string[] = [];
    const program = createProgram(createSchemaCommand({
      apiRequest: async (path: string) => {
        paths.push(path);
        return {
          token: "cloudflare:index/zone:Zone",
          inputs: { account: "string" },
          outputs: { id: "string" },
        };
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
      ["node", "opsy", "schema", "get", "cloudflare:index/zone:Zone"],
      { from: "node" },
    );

    expect(paths).toEqual(["/schemas/describe?type=cloudflare%3Aindex%2Fzone%3AZone"]);
  });
});
