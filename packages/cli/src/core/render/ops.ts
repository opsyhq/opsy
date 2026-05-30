export type RenderOp =
	| { op: "log"; line: string }
	| { op: "section"; title: string }
	| { op: "keyValue"; rows: Array<[string, unknown]> }
	| { op: "note"; msg: string }
	| { op: "warn"; msg: string }
	| { op: "success"; msg: string }
	| { op: "table"; rows: Record<string, unknown>[]; cols?: string[] }

export function renderScalar(v: unknown): string {
	if (v === "[redacted]") return "[redacted]"
	if (typeof v === "string") return JSON.stringify(v)
	if (typeof v === "number" || typeof v === "boolean" || v === null)
		return String(v)
	return JSON.stringify(v)
}
