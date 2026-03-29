import { describe, expect, test } from "bun:test";
import { createSseParser, fetchSse, parseSseStream } from "./streaming";

function streamFromChunks(chunks: string[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe("streaming", () => {
  test("parser handles LF, CRLF, comments, and multiline data", async () => {
    const seen: Array<{ event: string; data: string; id?: string }> = [];
    const parser = createSseParser((event) => {
      seen.push(event);
    });

    await parser.push(": heartbeat\r\n");
    await parser.push("id: exec-1:1\r\nevent: step.started\r\ndata: {\"line\":1}\r\n\r\n");
    await parser.push("id: exec-1:2\nevent: step.completed\ndata: {\"line\":1,\ndata: \"continued\":true}\n\n");
    await parser.finish();

    expect(seen).toEqual([
      {
        id: "exec-1:1",
        event: "step.started",
        data: "{\"line\":1}",
      },
      {
        id: "exec-1:2",
        event: "step.completed",
        data: "{\"line\":1,\n\"continued\":true}",
      },
    ]);
  });

  test("parseSseStream handles chunk boundaries across fields", async () => {
    const events: Array<{ event: string; data: string; id?: string }> = [];

    for await (const event of parseSseStream(streamFromChunks([
      "id: exec-1",
      ":1\neven",
      "t: execution.completed\ndata: {\"status\":",
      "\"succeeded\"}\n\n",
    ]))) {
      events.push(event);
    }

    expect(events).toEqual([
      {
        id: "exec-1:1",
        event: "execution.completed",
        data: "{\"status\":\"succeeded\"}",
      },
    ]);
  });

  test("fetchSse dedupes duplicate ids and reconnects with Last-Event-ID", async () => {
    const lastEventIds: Array<string | null> = [];
    let callCount = 0;
    const fakeFetch: typeof fetch = (async (_input, init) => {
      const headers = new Headers(init?.headers);
      lastEventIds.push(headers.get("Last-Event-ID"));
      callCount += 1;

      if (callCount === 1) {
        return new Response(streamFromChunks([
          "id: exec-1:1\nevent: step.started\ndata: one\n\n",
        ]), {
          headers: { "content-type": "text/event-stream" },
        });
      }

      return new Response(streamFromChunks([
        "id: exec-1:1\nevent: step.started\ndata: one\n\n",
        "id: exec-1:2\nevent: execution.completed\ndata: two\n\n",
      ]), {
        headers: { "content-type": "text/event-stream" },
      });
    }) as typeof fetch;

    const seen: string[] = [];
    const controller = new AbortController();

    for await (const event of fetchSse({
      url: "https://example.test/events",
      fetch: fakeFetch,
      signal: controller.signal,
      reconnect: true,
      reconnectDelayMs: 0,
    })) {
      seen.push(`${event.id}:${event.data}`);
      if (event.id === "exec-1:2") {
        controller.abort();
      }
    }

    expect(seen).toEqual([
      "exec-1:1:one",
      "exec-1:2:two",
    ]);
    expect(lastEventIds).toEqual([null, "exec-1:1"]);
  });
});
