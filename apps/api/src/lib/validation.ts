import { zValidator } from "@hono/zod-validator"
import type { Context, ValidationTargets } from "hono"
import { type ZodIssue, type ZodType, z } from "zod"
import type { AppEnv } from "../types"

const boolQueryField = z
	.enum(["true", "false"])
	.optional()
	.default("false")
	.transform((v) => v === "true")

export const forceQuery = z.object({ force: boolQueryField })

function formatZodIssues(issues: readonly ZodIssue[]): string {
	if (issues.length === 0) return "validation failed"
	return issues
		.map((i) => {
			const path = i.path.length > 0 ? i.path.join(".") : "(root)"
			return `${path}: ${i.message}`
		})
		.join("; ")
}

export const validate = <
	T extends ZodType,
	Target extends keyof ValidationTargets,
>(
	target: Target,
	schema: T,
) =>
	zValidator(target, schema, (result, c) => {
		if (!result.success) {
			const ctx = c as unknown as Context<AppEnv>
			return ctx.json(
				{
					error: formatZodIssues(result.error.issues),
					code: "validation_error",
					requestId: ctx.get("requestId"),
				},
				400,
			)
		}
	})
