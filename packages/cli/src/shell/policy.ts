export function formatApprovalPolicy(policy: string[]): string {
	return policy.length === 0 ? "none" : policy.join(",")
}
