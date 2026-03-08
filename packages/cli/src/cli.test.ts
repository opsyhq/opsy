import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { FileConfigStore } from "./config.js";
import { EXIT_CODE } from "./errors.js";
import { runCli } from "./cli.js";

function createWritableCapture() {
  let text = "";
  return {
    stream: {
      write(chunk: string | Uint8Array) {
        text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
        return true;
      },
    } as unknown as NodeJS.WritableStream,
    read() {
      return text;
    },
  };
}

function createInput(text: string) {
  const stream = Readable.from([text]) as Readable & { isTTY?: boolean };
  stream.isTTY = false;
  return stream as NodeJS.ReadableStream & { isTTY?: boolean };
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map(async (dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe("cli commands", () => {
  it("logs in with a token, validates it, and stores config", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opsy-cli-"));
    tempDirs.push(dir);
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    const env = { HOME: dir };
    const fetchImpl = mock(async () =>
      new Response(
        JSON.stringify({
          user: {
            id: "user_123",
            email: "user@example.com",
            firstName: "User",
            lastName: "Example",
            profilePictureUrl: null,
            agentName: "User Example",
            agentAvatarStyle: "shape",
            agentAvatarSeed: "seed",
          },
          actor: {
            userId: "user_123",
            orgId: "org_123",
            actorType: "user",
            authType: "pat",
            credentialId: "pat_123",
            credentialLabel: "CLI",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;

    const exitCode = await runCli(["auth", "login", "--token", "pat_123"], {
      env,
      fetchImpl,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(exitCode).toBe(EXIT_CODE.OK);
    expect(stdout.read()).toContain("user@example.com");
    expect(stderr.read()).toBe("");

    const configPath = new FileConfigStore(env).getPath();
    const saved = JSON.parse(await readFile(configPath, "utf8"));
    expect(saved.token).toBe("pat_123");
  });

  it("lists workspaces in compact text mode", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opsy-cli-"));
    tempDirs.push(dir);
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    const env = { HOME: dir };
    const store = new FileConfigStore(env);
    await store.save({ version: 1, token: "stored-token" });

    const fetchImpl = mock(async (input: string | URL) => {
      expect(String(input)).toBe("https://api.opsy.sh/workspaces");
      return new Response(JSON.stringify([
        {
          id: "11111111-1111-4111-8111-111111111111",
          slug: "acme",
          name: "Acme",
          ownerWorkosOrgId: "org_123",
          notes: null,
          createdAt: "2026-03-07T10:00:00.000Z",
          updatedAt: "2026-03-07T10:00:00.000Z",
          stackCount: 2,
          envCount: 3,
        },
      ]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const exitCode = await runCli(["workspace", "list"], {
      env,
      fetchImpl,
      stdout: stdout.stream,
      stderr: stderr.stream,
      configStore: store,
    });

    expect(exitCode).toBe(EXIT_CODE.OK);
    expect(stdout.read()).toBe("acme\tAcme\tstacks=2\tenvs=3\n");
    expect(stderr.read()).toBe("");
  });

  it("passes run list filters through to the workspace runs endpoint", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opsy-cli-"));
    tempDirs.push(dir);
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    const env = { HOME: dir };
    const store = new FileConfigStore(env);
    await store.save({ version: 1, token: "stored-token", apiUrl: "http://localhost:4000" });

    const fetchImpl = mock(async (input: string | URL) => {
      expect(String(input)).toBe(
        "http://localhost:4000/workspaces/acme/runs?stack=api&status=running&limit=10",
      );
      return new Response(JSON.stringify({
        items: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            shortId: "deadbeef",
            kind: "apply",
            status: "running",
            stackSlug: "api",
            envSlug: "prod",
            revisionId: null,
            revisionNumber: null,
            draftId: null,
            draftShortId: null,
            queuedAt: "2026-03-07T10:00:00.000Z",
            startedAt: "2026-03-07T10:00:05.000Z",
            finishedAt: null,
            error: null,
            requestedBy: null,
            requestedByType: "user",
          },
        ],
        nextCursor: null,
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const exitCode = await runCli(
      ["run", "list", "--workspace", "acme", "--stack", "api", "--status", "running", "--limit", "10"],
      {
        env,
        fetchImpl,
        stdout: stdout.stream,
        stderr: stderr.stream,
        configStore: store,
      },
    );

    expect(exitCode).toBe(EXIT_CODE.OK);
    expect(stdout.read()).toBe("deadbeef\trunning\tapply\tapi/prod\t2026-03-07T10:00:00.000Z\n");
    expect(stderr.read()).toBe("");
  });

  it("writes a draft from stdin and auto-creates it through REST when none exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opsy-cli-"));
    tempDirs.push(dir);
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    const env = { HOME: dir };
    const store = new FileConfigStore(env);
    await store.save({ version: 1, token: "stored-token", apiUrl: "http://localhost:4000" });

    const fetchImpl = mock(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "http://localhost:4000/workspaces/acme/stacks/api/drafts" && init?.method === "GET") {
        return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url === "http://localhost:4000/workspaces/acme/stacks/api/drafts" && init?.method === "POST") {
        return new Response(JSON.stringify({
          draftId: "33333333-3333-4333-8333-333333333333",
          shortId: "deadbeef",
        }), { status: 201, headers: { "content-type": "application/json" } });
      }
      if (url === "http://localhost:4000/workspaces/acme/stacks/api/drafts/deadbeef/spec" && init?.method === "PUT") {
        expect(init?.body).toBe(JSON.stringify({ yaml: "name: api\n" }));
        return new Response(JSON.stringify({
          draftId: "33333333-3333-4333-8333-333333333333",
          shortId: "deadbeef",
          warnings: [],
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected request: ${url} ${init?.method}`);
    }) as unknown as typeof fetch;

    const exitCode = await runCli(["draft", "write", "--workspace", "acme", "--stack", "api", "--quiet"], {
      env,
      fetchImpl,
      stdin: createInput("name: api\n"),
      stdout: stdout.stream,
      stderr: stderr.stream,
      configStore: store,
    });

    expect(exitCode).toBe(EXIT_CODE.OK);
    expect(stdout.read()).toBe("deadbeef\n");
    expect(stderr.read()).toBe("");
  });

  it("gets a draft without requiring workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opsy-cli-"));
    tempDirs.push(dir);
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    const env = { HOME: dir };
    const store = new FileConfigStore(env);
    await store.save({ version: 1, token: "stored-token", apiUrl: "http://localhost:4000" });

    const fetchImpl = mock(async (input: string | URL) => {
      expect(String(input)).toBe("http://localhost:4000/drafts/deadbeef");
      return new Response(JSON.stringify({
        id: "33333333-3333-4333-8333-333333333333",
        shortId: "deadbeef",
        name: null,
        spec: "name: api",
        specHash: "a".repeat(64),
        baseRevisionId: null,
        isStale: false,
        createdByType: "user",
        createdByUser: null,
        createdAt: "2026-03-07T10:00:00.000Z",
        updatedAt: "2026-03-07T10:00:00.000Z",
        baseRevision: null,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;

    const exitCode = await runCli(["draft", "get", "deadbeef"], {
      env,
      fetchImpl,
      stdout: stdout.stream,
      stderr: stderr.stream,
      configStore: store,
    });

    expect(exitCode).toBe(EXIT_CODE.OK);
    expect(stdout.read()).toContain("shortId\tdeadbeef");
    expect(stderr.read()).toBe("");
  });

  it("writes a known draft by short id without requiring workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opsy-cli-"));
    tempDirs.push(dir);
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    const env = { HOME: dir };
    const store = new FileConfigStore(env);
    await store.save({ version: 1, token: "stored-token", apiUrl: "http://localhost:4000" });

    const fetchImpl = mock(async (input: string | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://localhost:4000/drafts/deadbeef/spec");
      expect(init?.method).toBe("PUT");
      expect(init?.body).toBe(JSON.stringify({ yaml: "name: api\n" }));
      return new Response(JSON.stringify({
        draftId: "33333333-3333-4333-8333-333333333333",
        shortId: "deadbeef",
        warnings: [],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;

    const exitCode = await runCli(["draft", "write", "deadbeef", "--quiet"], {
      env,
      fetchImpl,
      stdin: createInput("name: api\n"),
      stdout: stdout.stream,
      stderr: stderr.stream,
      configStore: store,
    });

    expect(exitCode).toBe(EXIT_CODE.OK);
    expect(stdout.read()).toBe("deadbeef\n");
    expect(stderr.read()).toBe("");
  });

  it("calls the stack apply REST endpoint and preserves preview metadata", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opsy-cli-"));
    tempDirs.push(dir);
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    const env = { HOME: dir };
    const store = new FileConfigStore(env);
    await store.save({ version: 1, token: "stored-token", apiUrl: "http://localhost:4000" });

    const fetchImpl = mock(async (input: string | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://localhost:4000/workspaces/acme/stacks/api/apply");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({
        envSlug: "prod",
        draftShortId: "deadbeef",
        reason: "deploy draft",
      }));
      return new Response(JSON.stringify({
        status: "ready",
        workspaceId: "44444444-4444-4444-8444-444444444444",
        stackId: "55555555-5555-4555-8555-555555555555",
        envId: "66666666-6666-4666-8666-666666666666",
        runId: "77777777-7777-4777-8777-777777777777",
        jobId: "88888888-8888-4888-8888-888888888888",
        run: {
          id: "77777777-7777-4777-8777-777777777777",
          workspaceId: "44444444-4444-4444-8444-444444444444",
          stackId: "55555555-5555-4555-8555-555555555555",
          envId: "66666666-6666-4666-8666-666666666666",
          revisionId: null,
          draftId: "33333333-3333-4333-8333-333333333333",
          kind: "apply",
          status: "awaiting_approval",
          reason: "deploy draft",
          queuedAt: "2026-03-07T10:00:00.000Z",
          startedAt: "2026-03-07T10:00:05.000Z",
          finishedAt: null,
          error: null,
          shortId: "cafebabe",
        },
        previewResult: {
          changeSummary: { create: 1 },
        },
      }), { status: 201, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;

    const exitCode = await runCli(
      ["run", "apply", "--workspace", "acme", "--stack", "api", "--env", "prod", "--draft", "deadbeef", "--reason", "deploy draft"],
      {
        env,
        fetchImpl,
        stdout: stdout.stream,
        stderr: stderr.stream,
        configStore: store,
      },
    );

    expect(exitCode).toBe(EXIT_CODE.OK);
    expect(stdout.read()).toContain("status\tready");
    expect(stdout.read()).toContain("preview\tcreate=1");
    expect(stderr.read()).toBe("");
  });

  it("gets a run without requiring workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opsy-cli-"));
    tempDirs.push(dir);
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    const env = { HOME: dir };
    const store = new FileConfigStore(env);
    await store.save({ version: 1, token: "stored-token", apiUrl: "http://localhost:4000" });

    const fetchImpl = mock(async (input: string | URL) => {
      expect(String(input)).toBe("http://localhost:4000/runs/deadbeef");
      return new Response(JSON.stringify({
        id: "77777777-7777-4777-8777-777777777777",
        shortId: "deadbeef",
        kind: "apply",
        status: "awaiting_approval",
        reason: "deploy draft",
        stackSlug: "api",
        envSlug: "prod",
        revisionId: null,
        revisionNumber: null,
        draftId: "33333333-3333-4333-8333-333333333333",
        draftShortId: "cafebabe",
        queuedAt: "2026-03-07T10:00:00.000Z",
        startedAt: "2026-03-07T10:00:05.000Z",
        finishedAt: null,
        error: null,
        previewResult: null,
        applyResult: null,
        requestedBy: null,
        requestedByType: "user",
        approval: null,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;

    const exitCode = await runCli(["run", "get", "deadbeef"], {
      env,
      fetchImpl,
      stdout: stdout.stream,
      stderr: stderr.stream,
      configStore: store,
    });

    expect(exitCode).toBe(EXIT_CODE.OK);
    expect(stdout.read()).toContain("shortId\tdeadbeef");
    expect(stderr.read()).toBe("");
  });

  it("loads import targets from a file and prints the run id in quiet mode", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opsy-cli-"));
    tempDirs.push(dir);
    const payloadPath = join(dir, "import.json");
    await writeFile(payloadPath, JSON.stringify({
      envSlug: "prod",
      targets: [{ type: "aws:s3/bucket:Bucket", name: "assets", id: "bucket-123" }],
      reason: "seed state",
    }), "utf8");
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    const env = { HOME: dir };
    const store = new FileConfigStore(env);
    await store.save({ version: 1, token: "stored-token", apiUrl: "http://localhost:4000" });

    const fetchImpl = mock(async (input: string | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://localhost:4000/workspaces/acme/stacks/api/import");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({
        envSlug: "prod",
        targets: [{ type: "aws:s3/bucket:Bucket", name: "assets", id: "bucket-123" }],
        reason: "seed state",
      }));
      return new Response(JSON.stringify({
        status: "completed",
        workspaceId: "44444444-4444-4444-8444-444444444444",
        stackId: "55555555-5555-4555-8555-555555555555",
        envId: "66666666-6666-4666-8666-666666666666",
        runId: "99999999-9999-4999-8999-999999999999",
        jobId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        importedCount: 1,
        run: {
          id: "99999999-9999-4999-8999-999999999999",
          workspaceId: "44444444-4444-4444-8444-444444444444",
          stackId: "55555555-5555-4555-8555-555555555555",
          envId: "66666666-6666-4666-8666-666666666666",
          revisionId: null,
          draftId: null,
          importTargets: [{ type: "aws:s3/bucket:Bucket", name: "assets", id: "bucket-123" }],
          kind: "import",
          status: "applied",
          reason: "seed state",
          queuedAt: "2026-03-07T10:00:00.000Z",
          startedAt: "2026-03-07T10:00:05.000Z",
          finishedAt: "2026-03-07T10:00:10.000Z",
          error: null,
          shortId: "feedbeef",
        },
      }), { status: 201, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;

    const exitCode = await runCli(
      ["run", "import", "--workspace", "acme", "--stack", "api", "--file", payloadPath, "--quiet"],
      {
        env,
        fetchImpl,
        stdout: stdout.stream,
        stderr: stderr.stream,
        configStore: store,
      },
    );

    expect(exitCode).toBe(EXIT_CODE.OK);
    expect(stdout.read()).toBe("99999999-9999-4999-8999-999999999999\n");
    expect(stderr.read()).toBe("");
  });

  it("deletes a revision by number through the REST detail and delete endpoints", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opsy-cli-"));
    tempDirs.push(dir);
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    const env = { HOME: dir };
    const store = new FileConfigStore(env);
    await store.save({ version: 1, token: "stored-token", apiUrl: "http://localhost:4000" });

    const fetchImpl = mock(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "http://localhost:4000/workspaces/acme/stacks/api/revisions/7" && init?.method === "GET") {
        return new Response(JSON.stringify({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          revisionNumber: 7,
          spec: "name: api",
          specHash: "a".repeat(64),
          runId: null,
          createdByType: "user",
          createdByUser: null,
          createdAt: "2026-03-07T10:00:00.000Z",
          baseRevision: null,
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (
        url === "http://localhost:4000/workspaces/acme/stacks/api/revisions/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
        && init?.method === "DELETE"
      ) {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${url} ${init?.method}`);
    }) as unknown as typeof fetch;

    const exitCode = await runCli(
      ["revision", "delete", "7", "--workspace", "acme", "--stack", "api", "--quiet"],
      {
        env,
        fetchImpl,
        stdout: stdout.stream,
        stderr: stderr.stream,
        configStore: store,
      },
    );

    expect(exitCode).toBe(EXIT_CODE.OK);
    expect(stdout.read()).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb\n");
    expect(stderr.read()).toBe("");
  });

  it("writes org notes from stdin as JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opsy-cli-"));
    tempDirs.push(dir);
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    const env = { HOME: dir };
    const store = new FileConfigStore(env);
    await store.save({ version: 1, token: "stored-token", apiUrl: "http://localhost:4000" });

    const fetchImpl = mock(async (input: string | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://localhost:4000/org/notes");
      expect(init?.method).toBe("PUT");
      expect(init?.body).toBe(JSON.stringify({ content: "# context\nhello" }));
      return new Response(JSON.stringify({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        orgId: "org_123",
        content: "# context\nhello",
        createdAt: "2026-03-07T10:00:00.000Z",
        updatedAt: "2026-03-07T10:00:00.000Z",
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;

    const exitCode = await runCli(["org", "set-notes", "--json"], {
      env,
      fetchImpl,
      stdin: createInput("# context\nhello"),
      stdout: stdout.stream,
      stderr: stderr.stream,
      configStore: store,
    });

    expect(exitCode).toBe(EXIT_CODE.OK);
    expect(JSON.parse(stdout.read())).toMatchObject({
      orgId: "org_123",
      content: "# context\nhello",
    });
    expect(stderr.read()).toBe("");
  });

  it("returns a stable unauthenticated exit code when no token is configured", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opsy-cli-"));
    tempDirs.push(dir);
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    const env = { HOME: dir };

    const exitCode = await runCli(["workspace", "list"], {
      env,
      fetchImpl: mock(async () => new Response("{}")) as unknown as typeof fetch,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(exitCode).toBe(EXIT_CODE.UNAUTHENTICATED);
    expect(stdout.read()).toBe("");
    expect(stderr.read()).toContain("No token configured.");
  });
});
