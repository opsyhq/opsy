import { tool } from "ai"
import { z } from "zod"
import { RESOURCE_FIELD_ICON_PATTERN } from "./block"

const ICONIFY_BASE_URL = "https://api.iconify.design"
const LUCIDE_PREFIX = "lucide:"

const iconifySearchResponseSchema = z.object({
	icons: z.array(z.string()),
})

const iconifyCollectionResponseSchema = z.object({
	icons: z.record(z.string(), z.unknown()).optional(),
	aliases: z.record(z.string(), z.unknown()).optional(),
})

const searchLucideIconsInputSchema = z.object({
	query: z
		.string()
		.trim()
		.min(1)
		.max(120)
		.describe(
			"Search terms for Lucide icons, such as cpu, storage, network, security, region, tags, or lifecycle.",
		),
	limit: z.number().int().min(1).max(20).optional(),
})

export function getResourceFieldMetadataTools() {
	return {
		searchLucideIcons: tool({
			description:
				"Search Iconify's Lucide icon collection. Returns exact lucide:* icon IDs. Use this only when an icon would add quick visual meaning for a field; omit icons for generic or self-evident fields.",
			inputSchema: searchLucideIconsInputSchema,
			execute: async ({ query, limit }) => ({
				icons: await searchLucideIcons({
					query,
					limit: limit ?? 12,
				}),
			}),
		}),
	}
}

async function searchLucideIcons(input: {
	query: string
	limit: number
}): Promise<string[]> {
	const url = new URL("/search", ICONIFY_BASE_URL)
	url.searchParams.set("prefix", "lucide")
	url.searchParams.set("query", input.query)
	url.searchParams.set("limit", String(input.limit))
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`Iconify Lucide search failed with ${response.status}`)
	}
	const parsed = iconifySearchResponseSchema.parse(await response.json())
	return parsed.icons.filter((icon) => RESOURCE_FIELD_ICON_PATTERN.test(icon))
}

export async function existingLucideIconIds(
	iconIds: string[],
): Promise<Set<string>> {
	const unique = [...new Set(iconIds)]
	if (unique.length === 0) return new Set()
	const valid = unique.filter((icon) => RESOURCE_FIELD_ICON_PATTERN.test(icon))
	if (valid.length === 0) return new Set()
	const url = new URL("/lucide.json", ICONIFY_BASE_URL)
	url.searchParams.set(
		"icons",
		valid.map((icon) => icon.slice(LUCIDE_PREFIX.length)).join(","),
	)
	const response = await fetch(url)
	if (!response.ok) return new Set()
	const parsed = iconifyCollectionResponseSchema.parse(await response.json())
	const names = new Set([
		...Object.keys(parsed.icons ?? {}),
		...Object.keys(parsed.aliases ?? {}),
	])
	return new Set(
		valid.filter((icon) => names.has(icon.slice(LUCIDE_PREFIX.length))),
	)
}
