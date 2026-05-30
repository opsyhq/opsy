// Better Auth stores multi-role membership as a comma-joined string.
export function hasRole(
	role: string | undefined | null,
	target: string,
): boolean {
	return (
		role
			?.split(",")
			.map((r) => r.trim())
			.includes(target) ?? false
	)
}
