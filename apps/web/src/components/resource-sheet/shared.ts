import { z } from "zod"
import type { ChangeSetItem } from "@/lib/changeSetReactQuery"

export type Integration = {
	id: string
	slug: string
	provider: string
}

const SLUG_RE = /^[a-z0-9-]+$/

export const providerResourceFormSchema = z.object({
	slug: z
		.string()
		.min(1, "Required")
		.regex(SLUG_RE, "Lowercase letters, digits, and hyphens only"),
	displayName: z.string().optional(),
	integrationSlug: z.string().min(1, "Pick an integration"),
	values: z.record(z.string(), z.unknown()),
})

export type ProviderResourceForm = z.infer<typeof providerResourceFormSchema>

export const emptyResourceFormSchema = z.object({
	slug: z
		.string()
		.min(1, "Required")
		.regex(SLUG_RE, "Lowercase letters, digits, and hyphens only"),
	displayName: z.string().optional(),
})

export type EmptyResourceForm = z.infer<typeof emptyResourceFormSchema>

export function isCreateLikeStagedItem(item: ChangeSetItem): boolean {
	return item.kind === "create_resource" || item.kind === "import_resource"
}

export function inferProviderFromType(type: string): string {
	const idx = type.indexOf("_")
	return idx > 0 ? type.slice(0, idx) : ""
}

export function slugifyName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64)
}
