// Loose `string` arg: this is also called from `policies/always.ts` where the
// kind comes from PolicyCtx.action (defined in @opsy/provider, which has no
// access to the apps/api action-kind union).
export function isMutatingKind(kind: string): boolean {
	switch (kind) {
		case "create":
		case "update":
		case "delete":
		case "import":
			return true
		default:
			return false
	}
}
