import type { z } from "zod"

export interface PolicyCtx {
	action: { kind: string; approvedByType?: string | null }
	resource: { id: string } | null
	project: { id: string }
}
export interface PolicyResult {
	required: boolean
	approvers?: string[]
	reason?: string
}
export interface PolicyDef {
	id: string
	description: string
	params?: z.ZodType<unknown>
	evaluate(ctx: PolicyCtx): Promise<PolicyResult>
}
export function definePolicy(d: PolicyDef): PolicyDef {
	return d
}
