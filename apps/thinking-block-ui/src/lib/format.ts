export function formatDuration(value: number | null | undefined) {
	if (value === null || value === undefined) return "-"
	if (value < 1000) return `${value} ms`
	return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)} s`
}

export function formatDateTime(value: string | null | undefined) {
	if (!value) return "-"
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value))
}

export function truncateMiddle(value: string | null | undefined, size = 12) {
	if (!value) return "-"
	if (value.length <= size * 2 + 1) return value
	return `${value.slice(0, size)}...${value.slice(-size)}`
}

export function jsonText(value: unknown) {
	if (typeof value === "string") return value
	return JSON.stringify(value ?? null, null, 2)
}
