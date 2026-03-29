import { fetchSse, type SseMessage } from "@opsy/contracts";

type RequestOpts = {
  method?: string;
  body?: unknown;
  token: string;
  apiUrl: string;
  signal?: AbortSignal;
  lastEventId?: string | null;
  reconnect?: boolean;
};

type ApiErrorBody = {
  isError?: boolean;
  code?: string;
  message?: string;
  retryable?: boolean;
  details?: unknown;
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryable: boolean;
  readonly details?: unknown;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    const payload = (body ?? {}) as ApiErrorBody;
    super(payload.message ?? `HTTP ${status}`);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = payload.code;
    this.retryable = payload.retryable ?? false;
    this.details = payload.details;
    this.body = body;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export async function apiRequest<T = unknown>(path: string, opts: RequestOpts): Promise<T> {
  const url = `${opts.apiUrl}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
  };
  let requestBody: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(opts.body);
  }
  const res = await fetch(url, { method: opts.method ?? "GET", headers, body: requestBody, signal: opts.signal });
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  if (!res.ok) {
    throw new ApiRequestError(res.status, json);
  }
  return json as T;
}

export async function* apiStream(
  path: string,
  opts: RequestOpts,
): AsyncGenerator<SseMessage> {
  const url = `${opts.apiUrl}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
    Accept: "text/event-stream",
  };
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  for await (const event of fetchSse({
    url,
    signal: opts.signal,
    lastEventId: opts.lastEventId,
    reconnect: opts.reconnect ?? true,
    init: {
      method: opts.method ?? "GET",
      headers,
      body,
    },
  })) {
    yield event;
  }
}
