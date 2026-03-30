export type SseMessage = {
  event: string;
  data: string;
  id?: string;
  retry?: number;
};

type ParserState = {
  eventType: string;
  dataLines: string[];
  lastEventId?: string;
  retry?: number;
};

function createParserState(): ParserState {
  return {
    eventType: "",
    dataLines: [],
  };
}

function extractLine(buffer: string): { line: string; rest: string } | null {
  for (let index = 0; index < buffer.length; index += 1) {
    const char = buffer[index];
    if (char !== "\n" && char !== "\r") {
      continue;
    }
    const nextIndex = char === "\r" && buffer[index + 1] === "\n" ? index + 2 : index + 1;
    return {
      line: buffer.slice(0, index),
      rest: buffer.slice(nextIndex),
    };
  }
  return null;
}

export function createSseParser(onEvent: (event: SseMessage) => void | Promise<void>) {
  let buffer = "";
  let state = createParserState();

  const dispatch = async () => {
    if (state.dataLines.length === 0) {
      state = createParserState();
      return;
    }
    const message: SseMessage = {
      event: state.eventType || "message",
      data: state.dataLines.join("\n"),
    };
    if (state.lastEventId !== undefined) {
      message.id = state.lastEventId;
    }
    if (state.retry !== undefined) {
      message.retry = state.retry;
    }
    state = createParserState();
    await onEvent(message);
  };

  return {
    async push(chunk: string) {
      buffer += chunk;

      while (true) {
        const next = extractLine(buffer);
        if (!next) {
          return;
        }
        buffer = next.rest;
        const line = next.line;

        if (line === "") {
          await dispatch();
          continue;
        }
        if (line.startsWith(":")) {
          continue;
        }

        const separator = line.indexOf(":");
        const field = separator === -1 ? line : line.slice(0, separator);
        const rawValue = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");

        if (field === "event") {
          state.eventType = rawValue;
          continue;
        }
        if (field === "data") {
          state.dataLines.push(rawValue);
          continue;
        }
        if (field === "id") {
          if (!rawValue.includes("\u0000")) {
            state.lastEventId = rawValue;
          }
          continue;
        }
        if (field === "retry") {
          const retry = Number.parseInt(rawValue, 10);
          if (Number.isFinite(retry)) {
            state.retry = retry;
          }
        }
      }
    },
    async finish() {
      buffer = "";
      state = createParserState();
    },
  };
}

export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SseMessage> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const queue: SseMessage[] = [];
  const parser = createSseParser((event) => {
    queue.push(event);
  });

  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      await parser.push(decoder.decode(value, { stream: true }));
      while (queue.length > 0) {
        yield queue.shift()!;
      }
    }
  } finally {
    await parser.finish();
    reader.releaseLock();
  }
}

export type FetchSseOptions = {
  url: string;
  init?: RequestInit;
  /** Called on every connection attempt (including reconnects). Merged with `init`; takes precedence. */
  getInit?: () => RequestInit | Promise<RequestInit>;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
  lastEventId?: string | null;
  reconnect?: boolean;
  reconnectDelayMs?: number;
  maxSeenEventIds?: number;
};

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();
  for (const source of sources) {
    if (!source) {
      continue;
    }
    const next = new Headers(source);
    next.forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export async function* fetchSse(options: FetchSseOptions): AsyncGenerator<SseMessage> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error("fetch is not available.");
  }

  const maxSeenEventIds = options.maxSeenEventIds ?? 512;
  const seenEventIds = new Set<string>();
  const seenEventIdQueue: string[] = [];
  const highestSequenceByStream = new Map<string, number>();
  let lastEventId = options.lastEventId ?? null;
  const reconnect = options.reconnect ?? true;
  const reconnectDelayMs = options.reconnectDelayMs ?? 1_000;

  while (!options.signal?.aborted) {
    try {
      const dynamicInit = options.getInit ? await options.getInit() : undefined;
      const headers = mergeHeaders(
        options.init?.headers,
        dynamicInit?.headers,
        { Accept: "text/event-stream" },
      );
      if (lastEventId) {
        headers.set("Last-Event-ID", lastEventId);
      }

      const response = await fetchImpl(options.url, {
        ...options.init,
        ...dynamicInit,
        headers,
        signal: options.signal,
      });

      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`SSE response ${response.status}`);
        }
        // 5xx — retriable
        throw Object.assign(new Error(`SSE response ${response.status}`), { retriable: true });
      }
      if (!response.body) {
        throw new Error("SSE response has no body.");
      }

      for await (const event of parseSseStream(response.body, options.signal)) {
        if (event.id) {
          lastEventId = event.id;
          const separator = event.id.lastIndexOf(":");
          const streamId = separator > 0 ? event.id.slice(0, separator) : null;
          const sequenceText = separator > 0 ? event.id.slice(separator + 1) : null;
          if (streamId && sequenceText && /^\d+$/.test(sequenceText)) {
            const sequence = Number.parseInt(sequenceText, 10);
            if (sequence <= (highestSequenceByStream.get(streamId) ?? 0)) {
              continue;
            }
            highestSequenceByStream.set(streamId, sequence);
          } else {
            if (seenEventIds.has(event.id)) {
              continue;
            }
            seenEventIds.add(event.id);
            seenEventIdQueue.push(event.id);
            if (seenEventIdQueue.length > maxSeenEventIds) {
              const evictedId = seenEventIdQueue.shift();
              if (evictedId) {
                seenEventIds.delete(evictedId);
              }
            }
          }
        }
        yield event;
      }

      // Stream ended normally — reconnect if enabled
      if (!reconnect || options.signal?.aborted) {
        return;
      }
      await delay(reconnectDelayMs, options.signal);
    } catch (error) {
      if (options.signal?.aborted) {
        return;
      }
      // Network errors (TypeError) and 5xx responses are retriable
      const isRetriable = error instanceof TypeError
        || (error as { retriable?: boolean })?.retriable === true;
      if (!reconnect || !isRetriable) {
        throw error;
      }
      await delay(reconnectDelayMs, options.signal);
    }
  }
}
