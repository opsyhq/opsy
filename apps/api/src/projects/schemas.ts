import { z } from "zod"

const projectSlug = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, digits, and hyphens")

export const createProjectBody = z.object({
	slug: projectSlug,
})

export const updateProjectBody = z.object({
	approvalPolicy: z.array(z.string()).optional(),
	scanInterval: z.enum(["off", "hourly", "daily"]).optional(),
})

export type CreateProjectBody = z.infer<typeof createProjectBody>
export type UpdateProjectBody = z.infer<typeof updateProjectBody>
