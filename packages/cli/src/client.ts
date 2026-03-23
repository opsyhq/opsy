type RequestOpts = {
  method?: string;
  body?: unknown;
  token: string;
  apiUrl: string;
};

export async function apiRequest<T = unknown>(path: string, opts: RequestOpts): Promise<T> {
  const url = `${opts.apiUrl}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
  };
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, { method: opts.method ?? "GET", headers, body });
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  if (!res.ok) {
    const msg = (json as any).message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}
