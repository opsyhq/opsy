// Tabular formatter. Pure function: rows in, formatted string out.
// No color, no TTY check — caller bakes color into the row data if desired.
// Modeled after vercel's `output/table.ts` shape (rows + opts → string).
//
// We use objects + a column list rather than 2D arrays because almost every
// caller has data in object shape already, and extracting columns by name is
// less error-prone than positional indexing.

export function formatTable(
	rows: Record<string, unknown>[],
	columns?: string[],
): string {
	if (rows.length === 0) return ""
	const cols = columns ?? Object.keys(rows[0] ?? {})
	const widths = cols.map((col) =>
		Math.max(col.length, ...rows.map((row) => String(row[col] ?? "").length)),
	)
	const header = cols.map((col, i) => col.padEnd(widths[i] ?? 0)).join("  ")
	const divider = widths.map((w) => "-".repeat(w)).join("  ")
	const body = rows
		.map((row) =>
			cols
				.map((col, i) => String(row[col] ?? "").padEnd(widths[i] ?? 0))
				.join("  "),
		)
		.join("\n")
	return [header, divider, body].join("\n")
}
