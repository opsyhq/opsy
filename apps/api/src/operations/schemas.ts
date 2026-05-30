import { z } from "zod"
import {
	actorTypeEnum,
	operationKindEnum,
	operationStatusEnum,
} from "../lib/db/schema"

export const listOperationsQuery = z.object({
	kind: z.enum(operationKindEnum.enumValues).optional(),
	status: z.enum(operationStatusEnum.enumValues).optional(),
	open: z
		.enum(["true", "false"])
		.optional()
		.transform((v) => v === "true"),
	resourceId: z.uuid().optional(),
	resourceSlug: z.string().optional(),
	cursorCreatedAt: z.coerce.date().optional(),
	cursorId: z.uuid().optional(),
	limit: z.coerce.number().int().min(1).max(200).optional(),
	includeSystem: z
		.enum(["true", "false"])
		.optional()
		.transform((v) => v === "true"),
})

export const operationIdParam = z.object({ id: z.uuid() })

export type ListOperationsQuery = z.infer<typeof listOperationsQuery>

// JSONB column shapes. Defined once here so the writer (markOperationFailed /
// markOperationAwaitingApproval / approveOperation / cancelOperation), the
// reader (column .$type<…>() on the operations table), and the SSE/web layers
// share one source of truth.

export const operationErrorSchema = z.object({
	message: z.string(),
	code: z.string(),
	details: z.unknown(),
})

export type OperationError = z.infer<typeof operationErrorSchema>

const policyResultSchema = z.object({
	required: z.boolean(),
	approvers: z.array(z.string()).optional(),
	reason: z.string().optional(),
})

export const operationApprovalSchema = z.object({
	requestedAt: z.string(),
	policyIds: z.array(z.string()),
	policyResults: z.array(policyResultSchema),
	hook: z.object({ token: z.string() }).nullable(),
	approvedByType: z.enum(actorTypeEnum.enumValues).optional(),
	approvedById: z.uuid().optional(),
	approvedAt: z.string().optional(),
	canceledByType: z.enum(actorTypeEnum.enumValues).optional(),
	canceledById: z.uuid().optional(),
	canceledAt: z.string().optional(),
})

export type OperationApproval = z.infer<typeof operationApprovalSchema>
