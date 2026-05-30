import { beforeAll, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { buildFieldTree, type ResourceSchema } from "@opsy/provider"
import { migrate } from "@/lib/db/migrate"
import { thinkingBlockStore } from "@/thinking-blocks"
import {
	findReadyResourceFieldMetadata,
	RESOURCE_FIELD_METADATA_BLOCK_NAME,
	RESOURCE_FIELD_METADATA_BLOCK_VERSION,
	resourceFieldMetadataBlock,
	resourceFieldMetadataInput,
	resourceFieldMetadataPrompt,
	resourceFieldMetadataSchema,
} from "./block"
import {
	validateResourceFieldMetadata,
	validateResourceFieldMetadataIcons,
} from "./validators"

function schema(block: NonNullable<ResourceSchema["block"]>) {
	return buildFieldTree({ version: 0, block })
}

const baseInput = resourceFieldMetadataInput({
	provider: "aws",
	providerVersion: "6.44.0",
	kind: "resource",
	type: "aws_instance",
	schema: schema({
		attributes: {
			ami: {
				type: "string",
				required: true,
				description: "AMI ID to use for the instance.",
			},
			instance_type: { type: "string", required: true },
			vpc_security_group_ids: {
				type: ["set", "string"],
				optional: true,
				description: "Security group IDs.",
			},
			id: { type: "string", computed: true },
		},
	}),
	schemaHash: "hash",
})

resourceFieldMetadataBlock.stop()

beforeAll(async () => {
	await migrate()
})

describe("resource field metadata", () => {
	test("prompt is plain language with the exact supplied field records", () => {
		const prompt = resourceFieldMetadataPrompt(baseInput)
		expect(() => JSON.parse(prompt)).toThrow()
		expect(prompt).toContain(
			"Can you please create field metadata for this form using these supplied field records?",
		)
		expect(prompt).not.toContain("getSuppliedTerraformFields")
		expect(prompt).not.toContain("aws_instance")
		expect(prompt).not.toContain("6.44.0")

		const fieldRecords = JSON.parse(
			prompt.match(/```json\n([\s\S]*)\n```/)?.[1] ?? "null",
		)
		expect(fieldRecords).toEqual([
			{
				path: "ami",
				terraformName: "ami",
				type: "string",
				required: true,
				optional: false,
				computed: false,
				sensitive: false,
				deprecated: false,
				description: "AMI ID to use for the instance.",
			},
			{
				path: "instance_type",
				terraformName: "instance_type",
				type: "string",
				required: true,
				optional: false,
				computed: false,
				sensitive: false,
				deprecated: false,
			},
			{
				path: "vpc_security_group_ids",
				terraformName: "vpc_security_group_ids",
				type: ["set", "string"],
				required: false,
				optional: true,
				computed: false,
				sensitive: false,
				deprecated: false,
				description: "Security group IDs.",
			},
			{
				path: "id",
				terraformName: "id",
				type: "string",
				required: false,
				optional: false,
				computed: true,
				sensitive: false,
				deprecated: false,
			},
		])
		expect(fieldRecords).toEqual(baseInput.fields)
	})

	test("ready cache reads generated output by block version and schema hash", async () => {
		const type = `aws_unit_${randomUUID()}`
		const schemaHash = `hash-${randomUUID()}`
		const identity = ["aws", "resource", type, schemaHash].join(":")
		const artifact = await thinkingBlockStore.createArtifact({
			blockName: RESOURCE_FIELD_METADATA_BLOCK_NAME,
			blockVersion: RESOURCE_FIELD_METADATA_BLOCK_VERSION,
			identity,
			input: { type },
			createdAt: new Date(),
		})
		await thinkingBlockStore.markArtifactReady({
			artifactId: artifact.id,
			blockName: RESOURCE_FIELD_METADATA_BLOCK_NAME,
			blockVersion: RESOURCE_FIELD_METADATA_BLOCK_VERSION,
			identity,
			output: {
				fields: {
					unknown_cached_path: {
						label: "Cached label",
						icon: "lucide:not-checked-on-read",
					},
				},
			},
			readyAt: new Date(),
		})

		await expect(
			findReadyResourceFieldMetadata({
				provider: "aws",
				kind: "resource",
				type,
				schemaHash,
			}),
		).resolves.toMatchObject({
			artifactId: artifact.id,
			metadata: {
				fields: {
					unknown_cached_path: {
						label: "Cached label",
						icon: "lucide:not-checked-on-read",
					},
				},
			},
		})
	})

	test("validator enforces generation contract without repair or taste rules", () => {
		expect(
			validateResourceFieldMetadata({
				fields: baseInput.fields,
				metadata: {
					fields: {
						ami: { label: "AMI", icon: "lucide:box" },
						instance_type: { label: "Instance type", icon: "lucide:box" },
						vpc_security_group_ids: {
							label: "Security groups",
							help: "Attach groups that allow required traffic.",
						},
					},
				},
			}),
		).toEqual([])

		const issues = validateResourceFieldMetadata({
			fields: baseInput.fields,
			metadata: {
				fields: {
					ami: { label: " AMI ", help: " " },
					not_in_schema: { label: "Nope" },
				},
			},
		})

		expect(issues.map((issue) => issue.path)).toEqual([
			"fields.ami.label",
			"fields.ami.help",
			"fields.not_in_schema",
		])
	})

	test("prompt fields include nested block and object attribute paths", () => {
		const input = resourceFieldMetadataInput({
			provider: "aws",
			providerVersion: "6.44.0",
			kind: "resource",
			type: "aws_security_group",
			schema: schema({
				attributes: {
					config: {
						type: ["object", { enabled: "bool", mode: "string" }],
						optional: true,
					},
				},
				block_types: {
					ingress: {
						nesting_mode: "set",
						block: {
							attributes: {
								from_port: { type: "number", required: true },
								to_port: { type: "number", optional: true },
								arn: { type: "string", computed: true },
							},
						},
					},
				},
			}),
			schemaHash: "hash",
		})

		expect(input.fields.map((field) => field.path)).toEqual([
			"config",
			"config.enabled",
			"config.mode",
			"ingress",
			"ingress.from_port",
			"ingress.to_port",
			"ingress.arn",
		])
		expect(
			input.fields.find((field) => field.path === "config.enabled"),
		).toMatchObject({
			terraformName: "enabled",
			type: "bool",
			required: false,
			optional: true,
			computed: false,
		})
		expect(
			input.fields.find((field) => field.path === "ingress.arn"),
		).toMatchObject({
			terraformName: "arn",
			type: "string",
			required: false,
			optional: false,
			computed: true,
		})
	})

	test("validator accepts known nested paths and rejects unknown nested paths", () => {
		const input = resourceFieldMetadataInput({
			provider: "aws",
			providerVersion: "6.44.0",
			kind: "resource",
			type: "aws_security_group",
			schema: schema({
				block_types: {
					ingress: {
						nesting_mode: "set",
						block: {
							attributes: {
								from_port: { type: "number", required: true },
							},
						},
					},
				},
			}),
			schemaHash: "hash",
		})

		expect(
			validateResourceFieldMetadata({
				fields: input.fields,
				metadata: {
					fields: {
						ingress: { label: "Ingress" },
						"ingress.from_port": { label: "From port" },
					},
				},
			}),
		).toEqual([])
		expect(
			validateResourceFieldMetadata({
				fields: input.fields,
				metadata: {
					fields: {
						"ingress.cidr": { label: "CIDR" },
					},
				},
			}),
		).toEqual([
			expect.objectContaining({
				path: "fields.ingress.cidr",
			}),
		])
	})

	test("schema rejects extra keys instead of stripping them", () => {
		expect(
			resourceFieldMetadataSchema.safeParse({
				fields: {
					ami: {
						label: "AMI",
						widget: "text",
					},
				},
			}).success,
		).toBe(false)
		expect(
			resourceFieldMetadataSchema.safeParse({
				fields: {
					ami: { label: "AMI" },
				},
				examples: [],
			}).success,
		).toBe(false)
	})

	test("icon validator checks emitted Lucide icons against Iconify", async () => {
		const originalFetch = globalThis.fetch
		const iconifyFetch = (async (input) => {
			expect(String(input)).toContain("https://api.iconify.design/lucide.json")
			return new Response(
				JSON.stringify({
					prefix: "lucide",
					icons: {
						cpu: { body: "<path />" },
					},
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			)
		}) as typeof fetch
		iconifyFetch.preconnect = originalFetch.preconnect
		globalThis.fetch = iconifyFetch
		try {
			expect(
				await validateResourceFieldMetadataIcons({
					metadata: {
						fields: {
							instance_type: { label: "Instance type", icon: "lucide:cpu" },
							vpc_id: { label: "VPC", icon: "lucide:not-real" },
						},
					},
				}),
			).toEqual([
				{
					path: "fields.vpc_id.icon",
					message: "Field icon does not exist in Iconify's Lucide collection.",
					value: "lucide:not-real",
					expected: "An exact lucide:* icon id that exists in Iconify.",
				},
			])
		} finally {
			globalThis.fetch = originalFetch
		}
	})
})
