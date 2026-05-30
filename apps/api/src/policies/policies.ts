import type { PolicyCtx, PolicyResult } from "@opsy/provider"
import { eq } from "drizzle-orm"
import { db } from "../lib/db/client"
import { type Operation, projects, type Resource } from "../lib/db/schema"
import { baseLogger } from "../lib/logger"
import { policyRegistry } from "./registry.generated"

const log = baseLogger.child({ module: "policy" })

async function evaluatePolicies(
	ctx: PolicyCtx,
	policyIds: string[],
): Promise<PolicyResult[]> {
	if (policyIds.length === 0) return []
	return Promise.all(
		policyIds.map(async (id) => {
			const policy = policyRegistry[id]
			if (!policy) {
				log.warn({ policyId: id }, "unknown policy id — skipping")
				return { required: false }
			}
			return policy.evaluate(ctx)
		}),
	)
}

function isApprovalRequired(results: PolicyResult[]): boolean {
	return results.some((r) => r.required)
}

function approvedByType(approval: Operation["approval"]): string | null {
	if (!approval || typeof approval !== "object") return null
	const value = approval.approvedByType
	return typeof value === "string" ? value : null
}

export async function evaluateOperationApproval(ctx: {
	operation: Operation
	resource: Resource | null
}): Promise<{
	required: boolean
	policyIds: string[]
	policyResults: PolicyResult[]
}> {
	if (approvedByType(ctx.operation.approval)) {
		return { required: false, policyIds: [], policyResults: [] }
	}
	const project = await db.query.projects.findFirst({
		where: eq(projects.id, ctx.operation.projectId),
	})
	if (!project) throw new Error(`project not found: ${ctx.operation.projectId}`)
	const policyIds = ctx.resource?.approvalPolicy ?? project.approvalPolicy
	const policyResults = await evaluatePolicies(
		{
			action: {
				kind: ctx.operation.kind,
				approvedByType: approvedByType(ctx.operation.approval),
			},
			resource: ctx.resource ? { id: ctx.resource.id } : null,
			project: { id: project.id },
		},
		policyIds,
	)
	return {
		required: isApprovalRequired(policyResults),
		policyIds,
		policyResults,
	}
}
