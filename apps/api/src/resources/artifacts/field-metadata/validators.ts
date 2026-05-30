import { check } from "@opsy/thinking-blocks"
import type {
	GeneratedResourceFieldMetadata,
	ResourceFieldMetadataInput,
	ResourceFieldMetadataLlmOutput,
	ResourceFieldMetadataPromptField,
} from "./block"
import {
	RESOURCE_FIELD_HELP_MAX_LENGTH,
	RESOURCE_FIELD_ICON_PATTERN,
	RESOURCE_FIELD_LABEL_MAX_LENGTH,
	resourceFieldMetadataSchema,
} from "./block"
import { existingLucideIconIds } from "./iconify"

type ResourceFieldMetadataValidationIssue = {
	path: string
	message: string
	value: unknown
	expected?: string
}

export function validateResourceFieldMetadata(input: {
	fields: ResourceFieldMetadataPromptField[]
	metadata: GeneratedResourceFieldMetadata
}): ResourceFieldMetadataValidationIssue[] {
	const issues: ResourceFieldMetadataValidationIssue[] = []
	const known = new Set(input.fields.map((field) => field.path))
	for (const [path, metadata] of Object.entries(input.metadata.fields)) {
		if (!known.has(path)) {
			issues.push({
				path: `fields.${path}`,
				message:
					"Field metadata references a path that is not present in the supplied field list.",
				value: metadata,
				expected: "A path from the supplied fields array.",
			})
			continue
		}
		const label = metadata.label.trim()
		if (
			metadata.label !== label ||
			label.length === 0 ||
			label.length > RESOURCE_FIELD_LABEL_MAX_LENGTH
		) {
			issues.push({
				path: `fields.${path}.label`,
				message: "Field label must be non-empty, trimmed, and concise.",
				value: metadata.label,
				expected: `${RESOURCE_FIELD_LABEL_MAX_LENGTH} characters or fewer.`,
			})
		}
		if (metadata.help !== undefined) {
			const help = metadata.help.trim()
			if (
				metadata.help !== help ||
				help.length === 0 ||
				help.length > RESOURCE_FIELD_HELP_MAX_LENGTH
			) {
				issues.push({
					path: `fields.${path}.help`,
					message: "Field help must be trimmed short supplemental guidance.",
					value: metadata.help,
					expected: `${RESOURCE_FIELD_HELP_MAX_LENGTH} characters or fewer.`,
				})
			}
		}
		if (
			metadata.icon !== undefined &&
			!RESOURCE_FIELD_ICON_PATTERN.test(metadata.icon)
		) {
			issues.push({
				path: `fields.${path}.icon`,
				message:
					"Field icon must be an exact Iconify Lucide icon id such as lucide:cpu.",
				value: metadata.icon,
				expected: "An existing lucide:* icon id returned by searchLucideIcons.",
			})
		}
	}
	return issues
}

export async function validateResourceFieldMetadataIcons(input: {
	metadata: GeneratedResourceFieldMetadata
}): Promise<ResourceFieldMetadataValidationIssue[]> {
	const entries = Object.entries(input.metadata.fields).flatMap(
		([path, field]) =>
			typeof field.icon === "string" ? [{ path, icon: field.icon }] : [],
	)
	if (entries.length === 0) return []
	let existing: Set<string>
	try {
		existing = await existingLucideIconIds(entries.map((entry) => entry.icon))
	} catch (error) {
		return entries.map((entry) => ({
			path: `fields.${entry.path}.icon`,
			message: "Field icon could not be verified against Iconify.",
			value: entry.icon,
			expected:
				error instanceof Error
					? `Iconify verification must succeed: ${error.message}`
					: "Iconify verification must succeed.",
		}))
	}
	return entries
		.filter((entry) => !existing.has(entry.icon))
		.map((entry) => ({
			path: `fields.${entry.path}.icon`,
			message: "Field icon does not exist in Iconify's Lucide collection.",
			value: entry.icon,
			expected: "An exact lucide:* icon id that exists in Iconify.",
		}))
}

// Single validator: parse once, fold schema + Iconify-existence checks into
// one retry. The icon check does network IO, but both validators are invoked
// together at every retry anyway, so independent retries didn't buy anything
// — they only doubled the safeParse cost.
export const resourceFieldMetadataValidator = check<
	ResourceFieldMetadataInput,
	ResourceFieldMetadataLlmOutput
>("resource-field-metadata", {
	validate: async ({ input, output }) => {
		const parsed = resourceFieldMetadataSchema.safeParse(output)
		if (!parsed.success) {
			return { success: false, feedback: { issues: parsed.error.issues } }
		}
		const issues = [
			...validateResourceFieldMetadata({
				fields: input.fields,
				metadata: parsed.data,
			}),
			...(await validateResourceFieldMetadataIcons({ metadata: parsed.data })),
		]
		return issues.length === 0
			? { success: true }
			: { success: false, feedback: { issues } }
	},
})
