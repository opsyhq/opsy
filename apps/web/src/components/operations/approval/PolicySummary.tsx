import type { Operation } from "../types"

type ApprovalPolicy = {
	required: boolean
	approvers?: string[]
	reason?: string
}

// Renders the approval policy block when the operation is awaiting approval.
// Reads from `operation.approval.policyResults` which the backend writes when
// it marks an operation `awaiting_approval`.
export function PolicySummary({ operation }: { operation: Operation }) {
	const approval = operation.approval as
		| { policyResults?: ApprovalPolicy[] }
		| null
		| undefined
	const required = approval?.policyResults?.filter((p) => p.required) ?? []
	if (required.length === 0) return null
	return (
		<ul className="grid gap-1.5 text-xs text-muted-foreground">
			{required.map((policy) => (
				<li
					key={`${policy.reason ?? ""}:${policy.approvers?.join(",") ?? ""}`}
					className="grid gap-0.5"
				>
					{policy.reason && (
						<span className="text-foreground">{policy.reason}</span>
					)}
					{policy.approvers && policy.approvers.length > 0 && (
						<span className="font-mono text-[10px]">
							{policy.approvers.join(", ")}
						</span>
					)}
				</li>
			))}
		</ul>
	)
}
