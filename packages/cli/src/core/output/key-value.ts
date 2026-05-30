// Vertical key/value formatter — the missing primitive that started this
// refactor. Renders aligned `label: value` lines for show/get/view commands.
// Modeled after stripe-cli's `printWhoamiText` (Go's text/tabwriter).
//
//   profile:  default
//   api url:  http://localhost:4000
//   project:  mvp-demo
//
// Pure function: pairs in, formatted string out.

export function formatKeyValue(rows: Array<[string, unknown]>): string {
	if (rows.length === 0) return ""
	const labelWidth = Math.max(...rows.map(([k]) => k.length))
	return rows
		.map(([k, v]) => {
			const label = `${k}:`.padEnd(labelWidth + 2)
			return `${label}${formatValue(v)}`
		})
		.join("\n")
}

function formatValue(v: unknown): string {
	if (v === null || v === undefined) return ""
	if (typeof v === "string") return v
	if (typeof v === "number" || typeof v === "boolean") return String(v)
	return JSON.stringify(v)
}
