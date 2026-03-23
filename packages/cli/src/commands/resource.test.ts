import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { createResourceCommand } from "./resource";

function createProgram(command = createResourceCommand({
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

describe("resource CLI command", () => {
  test("resource get --live reads both stored detail and live outputs", async () => {
    const paths: string[] = [];
    const program = createProgram(createResourceCommand({
      apiRequest: async (path: string) => {
        paths.push(path);
        if (path.endsWith("/live")) return { outputs: { publicIp: "98.92.90.87" } };
        return { slug: "claw-test" };
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
      ["node", "opsy", "--json", "resource", "get", "claw-test", "--project", "opsy", "--env", "dev", "--live"],
      { from: "node" },
    );

    expect(paths).toEqual([
      "/projects/opsy/environments/dev/resources/claw-test",
      "/projects/opsy/environments/dev/resources/claw-test/live",
    ]);
  });

  test("resource sync hits the sync endpoint", async () => {
    const requests: Array<{ path: string; method: string | undefined }> = [];
    const program = createProgram(createResourceCommand({
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts.method });
        return { slug: "claw-test", conflicted: false };
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
      ["node", "opsy", "--json", "resource", "sync", "claw-test", "--project", "opsy", "--env", "dev"],
      { from: "node" },
    );

    expect(requests).toEqual([
      { path: "/projects/opsy/environments/dev/resources/claw-test/sync", method: "POST" },
    ]);
  });

  test("resource get --live falls back to stored detail when live read fails", async () => {
    const paths: string[] = [];
    const errors: string[] = [];
    const program = createProgram(createResourceCommand({
      apiRequest: async (path: string) => {
        paths.push(path);
        if (path.endsWith("/live")) throw new Error("provider timed out");
        return { slug: "claw-test" };
      },
      getToken: () => "test-token",
      getApiUrl: () => "http://localhost:4000",
      log: () => {},
      error: (message?: string) => errors.push(String(message ?? "")),
      exit: ((code: number) => {
        throw new Error(`exit:${code}`);
      }) as any,
    }));

    await program.parseAsync(
      ["node", "opsy", "--json", "resource", "get", "claw-test", "--project", "opsy", "--env", "dev", "--live"],
      { from: "node" },
    );

    expect(paths).toEqual([
      "/projects/opsy/environments/dev/resources/claw-test",
      "/projects/opsy/environments/dev/resources/claw-test/live",
    ]);
    expect(errors[0]).toContain("Warning: failed to read live outputs: provider timed out");
  });

  test("resource accept-live hits the accept-live endpoint", async () => {
    const requests: Array<{ path: string; method: string | undefined }> = [];
    const program = createProgram(createResourceCommand({
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts.method });
        return { slug: "claw-test", status: "live" };
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
      ["node", "opsy", "--json", "resource", "accept-live", "claw-test", "--project", "opsy", "--env", "dev"],
      { from: "node" },
    );

    expect(requests).toEqual([
      { path: "/projects/opsy/environments/dev/resources/claw-test/accept-live", method: "POST" },
    ]);
  });

  test("resource promote-current hits the promote-current endpoint", async () => {
    const requests: Array<{ path: string; method: string | undefined }> = [];
    const program = createProgram(createResourceCommand({
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts.method });
        return { change: { shortId: "cf95" }, operations: [{}] };
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
      ["node", "opsy", "resource", "promote-current", "claw-test", "--project", "opsy", "--env", "dev"],
      { from: "node" },
    );

    expect(requests).toEqual([
      { path: "/projects/opsy/environments/dev/resources/claw-test/promote-current", method: "POST" },
    ]);
  });

  test("resource restore hits the restore endpoint", async () => {
    const requests: Array<{ path: string; method: string | undefined; body: unknown }> = [];
    const program = createProgram(createResourceCommand({
      apiRequest: async (path: string, opts: any) => {
        requests.push({ path, method: opts.method, body: opts.body });
        return { change: { shortId: "cf95" }, operations: [{}] };
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
      ["node", "opsy", "resource", "restore", "claw-test", "--project", "opsy", "--env", "dev", "--operation", "op-123"],
      { from: "node" },
    );

    expect(requests).toEqual([
      {
        path: "/projects/opsy/environments/dev/resources/claw-test/restore",
        method: "POST",
        body: { operationId: "op-123" },
      },
    ]);
  });

  test("resource propose is not exposed anymore", async () => {
    const command = createResourceCommand();
    expect(command.commands.map((child) => child.name())).not.toContain("propose");
  });
});
