export function snakeToCamel(s: string): string {
	return s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}
