import { z } from "zod"

const operationLimitSchema = z.union([
	z.literal(10),
	z.literal(20),
	z.literal(50),
	z.literal(100),
	z.literal(200),
])

export const architectureSearchSchema = z.object({
	operationResource: z.string().min(1).optional(),
	operationKind: z.string().min(1).optional(),
	operationStatus: z.string().min(1).optional(),
	operationLimit: operationLimitSchema.optional(),
	importIntegrationSlug: z.string().min(1).optional(),
	op: z.string().min(1).optional(),
	resource: z.string().min(1).optional(),
	staged: z.string().min(1).optional(),
	mode: z.enum(["create", "detail"]).optional(),
	create: z.literal(true).optional(),
	import: z.literal(true).optional(),
})

export type ArchitectureSearch = z.infer<typeof architectureSearchSchema>

export type ArchitectureDetail =
	| { kind: "applied"; resourceSlug: string }
	| { kind: "staged"; stagedItemId: string; mode: "create" | "detail" }

export function detailFromSearch(
	search: ArchitectureSearch,
): ArchitectureDetail | undefined {
	if (search.staged) {
		return {
			kind: "staged",
			stagedItemId: search.staged,
			mode: search.mode ?? "detail",
		}
	}
	if (search.resource) {
		return { kind: "applied", resourceSlug: search.resource }
	}
	return undefined
}

export function detailToSearch(
	detail: ArchitectureDetail | undefined,
): Pick<ArchitectureSearch, "resource" | "staged" | "mode"> {
	if (!detail)
		return { resource: undefined, staged: undefined, mode: undefined }
	if (detail.kind === "applied") {
		return {
			resource: detail.resourceSlug,
			staged: undefined,
			mode: undefined,
		}
	}
	return {
		resource: undefined,
		staged: detail.stagedItemId,
		mode: detail.mode === "create" ? "create" : undefined,
	}
}
