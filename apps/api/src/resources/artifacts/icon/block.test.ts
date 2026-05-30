import { beforeAll, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import { thinkingBlockRuns } from "@/lib/db/schema"
import { thinkingBlockStore } from "@/thinking-blocks"
import {
	type ResourceTypeIconInput,
	resourceTypeIconAssetKeyValidator,
	resourceTypeIconBlock,
	resourceTypeIconIdentity,
	resourceTypeIconPrompt,
} from "./block"

beforeAll(async () => {
	await migrate()
})

describe("resourceTypeIconBlock", () => {
	test("identity ignores friendlyName", () => {
		const input = iconInput({ friendlyName: "Friendly bucket" })
		const renamed = iconInput({ friendlyName: "Renamed bucket" })

		expect(resourceTypeIconIdentity(input)).toBe(
			resourceTypeIconIdentity(renamed),
		)
		expect(resourceTypeIconIdentity(input)).not.toContain("Friendly bucket")
	})

	test("identity is shared across resource and data source usage", () => {
		const input = iconInput()
		const identity = resourceTypeIconIdentity(input)

		expect(identity).toBe(
			["resource-type-icon", input.provider, input.type, "unconfigured"].join(
				":",
			),
		)
	})

	test("generation prompt includes input scope and validator feedback", () => {
		const feedback = {
			issues: [
				{
					path: "assetKey",
					message: "Use a listed key that more closely matches the type.",
				},
			],
		}

		const prompt = JSON.parse(resourceTypeIconPrompt(iconInput(), feedback))

		expect(prompt.validationFeedback).toEqual(feedback)
		expect(prompt).not.toHaveProperty("providerVersion")
		expect(prompt.provider).toBe("aws")
		expect(prompt.type).toBe("aws_s3_bucket")
		expect(prompt.athena.providerPrefix).toBe("icons/aws/")
		expect(prompt).not.toHaveProperty("providerGuidance")
		expect(prompt.selectionPolicy.length).toBeGreaterThan(0)
	})

	test("generation prompt keeps provider catalog discovery dynamic", () => {
		const prompt = JSON.parse(
			resourceTypeIconPrompt({
				provider: "gcp",
				type: "google_compute_subnetwork",
			}),
		)

		expect(prompt.athena.providerPrefix).toBe("icons/gcp/")
		expect(prompt).not.toHaveProperty("providerGuidance")
		expect(JSON.stringify(prompt.selectionPolicy)).not.toContain("AWS")
		expect(prompt.instructions).not.toContain("AWS Architecture Icons")
	})

	test("asset-key validator rejects invalid asset keys", async () => {
		const result = await resourceTypeIconAssetKeyValidator.validate({
			input: iconInput(),
			output: {
				assetKey: `not-a-real-icon-${randomUUID()}`,
			},
			attempt: 1,
			raw: {} as never,
		})

		expect(result.success).toBe(false)
	})

	test("cache mode reads ready output from thinking_block_artifacts.output", async () => {
		const input = iconInput({ type: `aws_unit_${randomUUID()}` })
		const identity = resourceTypeIconIdentity(input)
		const createdAt = new Date()
		const artifact = await thinkingBlockStore.createArtifact({
			blockName: resourceTypeIconBlock.name,
			blockVersion: resourceTypeIconBlock.version,
			identity,
			input,
			createdAt,
		})
		await thinkingBlockStore.markArtifactReady({
			artifactId: artifact.id,
			blockName: resourceTypeIconBlock.name,
			blockVersion: resourceTypeIconBlock.version,
			identity,
			output: {
				assetKey:
					"icons/aws/01302026/Architecture-Service-Icons_01302026/Arch_Storage/64/Arch_Amazon-Simple-Storage-Service_64.svg",
			},
			readyAt: new Date(),
		})

		const lookup = await resourceTypeIconBlock.get(
			{ ...input, friendlyName: "Different friendly name" },
			{ mode: "cache" },
		)
		const runs = await db
			.select()
			.from(thinkingBlockRuns)
			.where(eq(thinkingBlockRuns.thinkingBlockArtifactId, artifact.id))

		expect(lookup.artifactId).toBe(artifact.id)
		expect(lookup.data).toEqual({
			assetKey:
				"icons/aws/01302026/Architecture-Service-Icons_01302026/Arch_Storage/64/Arch_Amazon-Simple-Storage-Service_64.svg",
		})
		expect(runs).toHaveLength(0)
	})
})

function iconInput(
	overrides: Partial<ResourceTypeIconInput> = {},
): ResourceTypeIconInput {
	return {
		provider: "aws",
		type: "aws_s3_bucket",
		...overrides,
	}
}
