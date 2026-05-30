let httpDebugEnabled = false
let httpDebugSink = (line: string): void => {
	process.stderr.write(line)
}

export function setHttpDebugEnabled(enabled: boolean): void {
	httpDebugEnabled = enabled
}

export function setHttpDebugSink(sink?: (line: string) => void): void {
	httpDebugSink = sink ?? ((line: string) => process.stderr.write(line))
}

export function emitHttpDebug(
	input: string | URL | Request,
	init: RequestInit | undefined,
	result: HttpDebugResult,
): void {
	if (!httpDebugEnabled) return
	const { method, path } = requestSummary(input, init)
	const duration = Math.max(0, Math.round(result.durationMs))
	const outcome = "status" in result ? `status=${result.status}` : "error"
	httpDebugSink(`[debug] ${method} ${path} ${outcome} duration=${duration}ms\n`)
}

type HttpDebugResult =
	| { status: number; durationMs: number }
	| { error: unknown; durationMs: number }

function requestSummary(
	input: string | URL | Request,
	init?: RequestInit,
): { method: string; path: string } {
	const request = input instanceof Request ? input : undefined
	const method = String(init?.method ?? request?.method ?? "GET").toUpperCase()
	const url = request?.url ?? String(input)
	return { method, path: safePath(url) }
}

function safePath(url: string): string {
	try {
		const parsed = new URL(url)
		return parsed.pathname || "/"
	} catch {
		const [path] = url.split("?", 1)
		return path || "/"
	}
}
