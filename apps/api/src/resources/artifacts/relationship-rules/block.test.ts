import { beforeAll, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import {
	buildFieldTree,
	type OpsyProvider,
	type ResourceSchema,
} from "@opsy/provider"
import { Output, ToolLoopAgent } from "ai"
import { MockLanguageModelV3 } from "ai/test"
import { migrate } from "@/lib/db/migrate"
import type { ProviderRef } from "@/provider-runtime"
import { ThinkingBlock, thinkingBlockInputHash } from "@opsy/thinking-blocks"
import { thinkingBlockStore } from "@/thinking-blocks"
import {
	getRelationshipRulesArtifactOutput,
	RELATIONSHIP_RULES_CANDIDATE_MODEL,
	RELATIONSHIP_RULES_MODEL,
	type RelationshipRulesBlockInput,
	relationshipRulesArtifact,
	relationshipRulesGenerationPrompt,
	relationshipRulesIdentityUniquenessValidator,
	relationshipRulesProviderSchemaValidator,
} from "./block"
import {
	getReadyRelationshipRules,
	getReadyRelationshipRulesInvolving,
} from "./query"
import {
	RELATIONSHIP_RULES_BLOCK_NAME,
	RELATIONSHIP_RULES_BLOCK_VERSION,
	type RelationshipRulesArtifactOutput,
	type RelationshipRulesLlmOutput,
	relationshipRulesLlmSchema,
} from "./schema"
import {
	validateRelationshipRuleIdentityUniqueness,
	validateRelationshipRulesProviderSchema,
} from "./validators"

type MockGenerateResult = Awaited<ReturnType<MockLanguageModelV3["doGenerate"]>>

// Production keys relationship-rules artifacts by hash(schema.identity); the
// fixtures below are raw cty, so build the envelope before hashing.
const hashResourceSchema = (schema: ResourceSchema): string =>
	thinkingBlockInputHash(buildFieldTree(schema).identity)

const sourceSchema: ResourceSchema = {
	version: 0,
	block: {
		attributes: {
			vpc_id: {
				type: "string",
				optional: true,
				description: "ID of the VPC that owns this resource.",
			},
			route: {
				type: [
					"set",
					[
						"object",
						{
							gateway_id: "string",
						},
					],
				],
				optional: true,
				description: "Route entries.",
			},
			target_group_arns: {
				type: ["list", "string"],
				optional: true,
			},
		},
		block_types: {
			placement: {
				nesting_mode: "list",
				max_items: 1,
				block: {
					attributes: {
						subnet_id: { type: "string", optional: true },
					},
				},
			},
		},
	},
}

const vpcSchema: ResourceSchema = {
	version: 0,
	block: {
		attributes: {
			id: { type: "string", computed: true },
			arn: { type: "string", computed: true },
		},
	},
}

const gatewaySchema: ResourceSchema = {
	version: 0,
	block: {
		attributes: {
			id: { type: "string", computed: true },
			vpc_id: { type: "string", optional: true },
		},
	},
}

const natGatewaySchema: ResourceSchema = {
	version: 0,
	block: {
		attributes: {
			id: { type: "string", computed: true },
			allocation_id: { type: "string", optional: true },
			subnet_id: { type: "string", optional: true },
		},
	},
}

const eipSchema: ResourceSchema = {
	version: 0,
	block: {
		attributes: {
			allocation_id: { type: "string", computed: true },
			id: { type: "string", computed: true },
		},
	},
}

const subnetSchema: ResourceSchema = {
	version: 0,
	block: {
		attributes: {
			id: { type: "string", computed: true },
		},
	},
}

const targetGroupSchema: ResourceSchema = {
	version: 0,
	block: {
		attributes: {
			arn: { type: "string", computed: true },
		},
	},
}

const providerSchemas: Record<string, ResourceSchema> = {
	aws_unit: sourceSchema,
	aws_vpc: vpcSchema,
	aws_internet_gateway: gatewaySchema,
	aws_nat_gateway: natGatewaySchema,
	aws_eip: eipSchema,
	aws_subnet: subnetSchema,
	aws_lb_target_group: targetGroupSchema,
}

const provider: OpsyProvider = {
	name: "aws",
	info: { tfSource: "hashicorp/aws", version: "6.44.0" },
	capabilities: {
		resourceCount: Object.keys(providerSchemas).length,
		dataSourceCount: 0,
	},
	init: async () => {},
	searchTypes: async ({ q = "", limit = 25, offset = 0 }) => {
		const results = Object.keys(providerSchemas)
			.filter((type) => type.includes(q))
			.slice(offset, offset + limit)
			.map((type) => ({ type, kinds: ["resource" as const] }))
		return {
			results,
			truncated: Object.keys(providerSchemas).length > offset + limit,
		}
	},
	getSchema: async (type: string, kind?: "resource" | "data") => {
		if (kind === "data") return undefined
		const raw = providerSchemas[type]
		if (!raw) return undefined
		const schema = buildFieldTree(raw)
		return kind === "resource" ? schema : { resource: schema }
	},
	getProviderConfigSchema: async () => undefined,
	getType: async (type: string) =>
		providerSchemas[type]
			? {
					type,
					identity: { kind: "passthrough", format: "{id}", fields: ["id"] },
					capabilities: { resource: true, data: false },
				}
			: undefined,
	dispatch: async () => {
		throw new Error("test provider does not dispatch operations")
	},
}

const ref: ProviderRef = {
	name: "aws",
	source: "hashicorp/aws",
	version: "6.44.0",
	runtime: "static",
}

function unitRule(
	path: string,
	targetType: string,
	targetPath: string,
	relationship: RelationshipRulesLlmOutput["rules"][number]["relationship"],
): RelationshipRulesLlmOutput["rules"][number] {
	return {
		source: { kind: "resource", type: "aws_unit", path },
		target: { kind: "resource", type: targetType, path: targetPath },
		relationship,
	}
}

beforeAll(async () => {
	await migrate()
})

describe("relationship rules block", () => {
	test("keeps the cheaper relationship-rule model as a candidate until promoted", () => {
		expect(RELATIONSHIP_RULES_MODEL).toBe("gpt-5.4")
		expect(RELATIONSHIP_RULES_CANDIDATE_MODEL).toBe("gpt-5.4")
	})

	test("prompt sends source schema context and provider tools", () => {
		const prompt = relationshipRulesGenerationPrompt(
			{
				provider,
				ref,
				kind: "resource",
				type: "aws_unit",
				schema: buildFieldTree(sourceSchema),
				schemaHash: "hash",
			},
			undefined,
			{
				currentRelationships: [
					{
						key: "known-rule",
						source: {
							kind: "resource",
							type: "aws_internet_gateway",
							path: "vpc_id",
						},
						target: { kind: "resource", type: "aws_unit", path: "vpc_id" },
						relationship: "ATTACHMENT",
					},
				],
			},
		)
		const contextJson = prompt.prompt.match(/```json\n([\s\S]+)\n```/)?.[1]
		if (!contextJson) throw new Error("missing prompt context")
		const context = JSON.parse(contextJson)

		expect(context).toMatchObject({
			provider: "aws",
			providerVersion: "6.44.0",
			kind: "resource",
			type: "aws_unit",
			schemaHash: "hash",
			validationFeedback: [],
		})
		expect(context.fields).toContainEqual(
			expect.objectContaining({ path: "vpc_id" }),
		)
		expect(context.currentRelationships).toEqual([
			{
				key: "known-rule",
				source: {
					kind: "resource",
					type: "aws_internet_gateway",
					path: "vpc_id",
				},
				target: { kind: "resource", type: "aws_unit", path: "vpc_id" },
				relationship: "ATTACHMENT",
			},
		])
		expect(Object.keys(prompt.tools)).toEqual([
			"searchProviderTypes",
			"getProviderTypeSchema",
		])
	})

	test("materializes stable keys", () => {
		const output: RelationshipRulesLlmOutput = {
			rules: [
				unitRule("vpc_id", "aws_vpc", "id", "SCOPE"),
				unitRule(
					"route.gateway_id",
					"aws_internet_gateway",
					"id",
					"ATTACHMENT",
				),
				unitRule("placement.subnet_id", "aws_subnet", "id", "ASSOCIATION"),
			],
		}

		const materialized = getRelationshipRulesArtifactOutput({
			output,
		})
		const repeated = getRelationshipRulesArtifactOutput({
			output,
		})

		expect(materialized.rules.map(({ key: _key, ...rule }) => rule)).toEqual([
			output.rules[0],
			output.rules[1],
			output.rules[2],
		])
		expect(materialized.rules.map((rule) => rule.key)).toEqual(
			repeated.rules.map((rule) => rule.key),
		)
		expect(new Set(materialized.rules.map((rule) => rule.key)).size).toBe(3)
	})

	test("mocked agent block run generates, validates, and commits artifact rules", async () => {
		const generated = {
			rules: [unitRule("vpc_id", "aws_vpc", "id", "REFERENCE")],
		} satisfies RelationshipRulesLlmOutput
		const model = mockModel([JSON.stringify(generated)])
		const block = new ThinkingBlock<
			RelationshipRulesBlockInput,
			RelationshipRulesLlmOutput,
			RelationshipRulesArtifactOutput
		>({
			agent: new ToolLoopAgent({
				id: "relationship-rules-mock-generator",
				model,
				output: Output.object({ schema: relationshipRulesLlmSchema }),
			}),
			name: `relationship-rules-mock-${randomUUID()}`,
			store: thinkingBlockStore,
			artifact: relationshipRulesArtifact,
			identity: (input) =>
				[input.ref.name, input.kind, input.type, input.schemaHash].join(":"),
			prepareCall: ({ input, feedback }) => {
				if (!input.provider) throw new Error("test input must include provider")
				const prompt = relationshipRulesGenerationPrompt(
					{ ...input, provider: input.provider },
					feedback,
				)
				return { prompt: prompt.prompt, options: prompt }
			},
			validators: [
				relationshipRulesProviderSchemaValidator,
				relationshipRulesIdentityUniquenessValidator,
			],
		})

		try {
			const result = await block.generate({
				ref,
				provider,
				kind: "resource",
				type: "aws_unit",
				schema: buildFieldTree(sourceSchema),
				schemaHash: `hash-${randomUUID()}`,
			})

			expect(result.ok).toBe(true)
			if (!result.ok) throw new Error("expected generated artifact")
			expect(result.output.rules[0]).toMatchObject({
				...generated.rules[0],
			})
			expect(result.output.rules[0]?.key).toEqual(expect.any(String))
		} finally {
			block.stop()
		}
	})

	test("provider-schema validator rejects unknown source paths, targets, and target paths", async () => {
		const issues = await validateRelationshipRulesProviderSchema({
			provider,
			kind: "resource",
			type: "aws_unit",
			schema: buildFieldTree(sourceSchema),
			output: {
				rules: [
					{
						source: {
							kind: "resource",
							type: "aws_unit",
							path: "missing_id",
						},
						target: { kind: "resource", type: "aws_vpc", path: "id" },
						relationship: "REFERENCE",
					},
					{
						source: { kind: "resource", type: "aws_unit", path: "vpc_id" },
						target: { kind: "resource", type: "aws_missing", path: "id" },
						relationship: "REFERENCE",
					},
					{
						source: { kind: "resource", type: "aws_unit", path: "vpc_id" },
						target: {
							kind: "resource",
							type: "aws_vpc",
							path: "missing",
						},
						relationship: "REFERENCE",
					},
				],
			},
		})
		expect(issues.map((issue) => issue.path)).toEqual([
			"rules.0.source.path",
			"rules.1.target.type",
			"rules.2.target.path",
		])
	})

	test("provider-schema validator accepts creation scope relationships", async () => {
		expect(
			await validateRelationshipRulesProviderSchema({
				provider,
				kind: "resource",
				type: "aws_unit",
				schema: buildFieldTree(sourceSchema),
				output: {
					rules: [unitRule("vpc_id", "aws_vpc", "id", "SCOPE")],
				},
			}),
		).toEqual([])
	})

	test("provider-schema validator accepts one-host attachments while preserving multi-target references", async () => {
		expect(
			await validateRelationshipRulesProviderSchema({
				provider,
				kind: "resource",
				type: "aws_internet_gateway",
				schema: buildFieldTree(gatewaySchema),
				output: {
					rules: [
						{
							source: {
								kind: "resource",
								type: "aws_internet_gateway",
								path: "vpc_id",
							},
							target: { kind: "resource", type: "aws_vpc", path: "id" },
							relationship: "ATTACHMENT",
						},
					],
				},
			}),
		).toEqual([])
		expect(
			await validateRelationshipRulesProviderSchema({
				provider,
				kind: "resource",
				type: "aws_nat_gateway",
				schema: buildFieldTree(natGatewaySchema),
				output: {
					rules: [
						{
							source: {
								kind: "resource",
								type: "aws_nat_gateway",
								path: "subnet_id",
							},
							target: { kind: "resource", type: "aws_subnet", path: "id" },
							relationship: "ATTACHMENT",
						},
					],
				},
			}),
		).toEqual([])
		expect(
			await validateRelationshipRulesProviderSchema({
				provider,
				kind: "resource",
				type: "aws_unit",
				schema: buildFieldTree(sourceSchema),
				output: {
					rules: [
						unitRule(
							"target_group_arns",
							"aws_lb_target_group",
							"arn",
							"REFERENCE",
						),
					],
				},
			}),
		).toEqual([])
	})

	test("provider-schema validator rejects rules whose source is not the generated type", async () => {
		const issues = await validateRelationshipRulesProviderSchema({
			provider,
			kind: "resource",
			type: "aws_unit",
			schema: buildFieldTree(sourceSchema),
			output: {
				rules: [
					{
						source: { kind: "resource", type: "aws_subnet", path: "id" },
						target: { kind: "resource", type: "aws_vpc", path: "arn" },
						relationship: "REFERENCE",
					},
				],
			},
		})

		expect(issues.map((issue) => issue.path)).toEqual(["rules.0.source"])
	})

	test("provider-schema validator rejects backward relationships into the generated type", async () => {
		const issues = await validateRelationshipRulesProviderSchema({
			provider,
			kind: "resource",
			type: "aws_nat_gateway",
			schema: buildFieldTree(natGatewaySchema),
			output: {
				rules: [
					{
						source: {
							kind: "resource",
							type: "aws_eip",
							path: "allocation_id",
						},
						target: {
							kind: "resource",
							type: "aws_nat_gateway",
							path: "allocation_id",
						},
						relationship: "ATTACHMENT",
					},
				],
			},
		})

		expect(issues.map((issue) => issue.path)).toEqual(["rules.0.source"])
	})

	test("provider-schema validator rejects unrelated computed own-identity pairs", async () => {
		const issues = await validateRelationshipRulesProviderSchema({
			provider,
			kind: "resource",
			type: "aws_subnet",
			schema: buildFieldTree(subnetSchema),
			output: {
				rules: [
					{
						source: { kind: "resource", type: "aws_subnet", path: "id" },
						target: { kind: "resource", type: "aws_vpc", path: "id" },
						relationship: "REFERENCE",
					},
				],
			},
		})

		expect(issues.map((issue) => issue.path)).toEqual(["rules.0"])
		expect(issues[0]?.message).toContain("computed own-identity")
	})

	test("identity validator rejects ambiguous outputs", () => {
		const duplicateIdentity: RelationshipRulesLlmOutput = {
			rules: [
				unitRule("vpc_id", "aws_vpc", "id", "REFERENCE"),
				unitRule("vpc_id", "aws_vpc", "id", "REFERENCE"),
			],
		}

		expect(
			validateRelationshipRuleIdentityUniqueness({
				output: duplicateIdentity,
			}).map((issue) => issue.path),
		).toEqual(["rules.1"])
	})

	test("ready cache ignores artifacts that do not match the semantic rule schema", async () => {
		const type = `aws_unit_${randomUUID()}`
		const schemaHash = `hash-${randomUUID()}`
		const identity = ["aws", "resource", type, schemaHash].join(":")
		const artifact = await thinkingBlockStore.createArtifact({
			blockName: RELATIONSHIP_RULES_BLOCK_NAME,
			blockVersion: RELATIONSHIP_RULES_BLOCK_VERSION,
			identity,
			input: { type },
			createdAt: new Date(),
		})
		await thinkingBlockStore.markArtifactReady({
			artifactId: artifact.id,
			blockName: RELATIONSHIP_RULES_BLOCK_NAME,
			blockVersion: RELATIONSHIP_RULES_BLOCK_VERSION,
			identity,
			output: {
				rules: [
					{
						key: "old-shape",
						sourcePath: "vpc_id",
						targetKind: "resource",
						targetType: "aws_vpc",
						targetPath: "id",
						role: "LEGACY_ROLE",
					},
				],
			},
			readyAt: new Date(),
		})

		await expect(
			getReadyRelationshipRules({
				ref,
				kind: "resource",
				type,
				schemaHash,
			}),
		).resolves.toBeNull()
	})

	test("ready cache reads artifact output by block version and schema hash", async () => {
		const type = `aws_unit_${randomUUID()}`
		const schemaHash = `hash-${randomUUID()}`
		const oldIdentity = ["aws", "resource", type, schemaHash].join(":")
		const oldArtifact = await thinkingBlockStore.createArtifact({
			blockName: RELATIONSHIP_RULES_BLOCK_NAME,
			blockVersion: "v6",
			identity: oldIdentity,
			input: { type },
			createdAt: new Date(),
		})
		await thinkingBlockStore.markArtifactReady({
			artifactId: oldArtifact.id,
			blockName: RELATIONSHIP_RULES_BLOCK_NAME,
			blockVersion: "v6",
			identity: oldIdentity,
			output: { rules: [] },
			readyAt: new Date(),
		})

		await expect(
			getReadyRelationshipRules({
				ref,
				kind: "resource",
				type,
				schemaHash,
			}),
		).resolves.toBeNull()

		const identity = ["aws", "resource", type, schemaHash].join(":")
		const candidate = unitRule("vpc_id", "aws_vpc", "id", "REFERENCE")
		const output = getRelationshipRulesArtifactOutput({
			output: { rules: [candidate] },
		})
		const artifact = await thinkingBlockStore.createArtifact({
			blockName: RELATIONSHIP_RULES_BLOCK_NAME,
			blockVersion: RELATIONSHIP_RULES_BLOCK_VERSION,
			identity,
			input: { type },
			createdAt: new Date(),
		})
		await thinkingBlockStore.markArtifactReady({
			artifactId: artifact.id,
			blockName: RELATIONSHIP_RULES_BLOCK_NAME,
			blockVersion: RELATIONSHIP_RULES_BLOCK_VERSION,
			identity,
			output,
			readyAt: new Date(),
		})

		await expect(
			getReadyRelationshipRules({
				ref,
				kind: "resource",
				type,
				schemaHash,
			}),
		).resolves.toEqual({
			artifactId: artifact.id,
			schemaHash,
			rules: output.rules,
		})
	})

	test("ready relationship query reads ready rules from other type artifacts", async () => {
		const sourceSchemaHash = hashResourceSchema(gatewaySchema)
		const selfSchemaHash = hashResourceSchema(vpcSchema)
		const rule = {
			source: {
				kind: "resource",
				type: "aws_internet_gateway",
				path: "vpc_id",
			},
			target: { kind: "resource", type: "aws_vpc", path: "id" },
			relationship: "ATTACHMENT",
		} satisfies RelationshipRulesLlmOutput["rules"][number]
		const sourceIdentity = [
			"aws",
			"resource",
			"aws_internet_gateway",
			sourceSchemaHash,
		].join(":")
		const sourceArtifact = await thinkingBlockStore.createArtifact({
			blockName: RELATIONSHIP_RULES_BLOCK_NAME,
			blockVersion: RELATIONSHIP_RULES_BLOCK_VERSION,
			identity: sourceIdentity,
			input: { type: "aws_internet_gateway" },
			createdAt: new Date(),
		})
		await thinkingBlockStore.markArtifactReady({
			artifactId: sourceArtifact.id,
			blockName: RELATIONSHIP_RULES_BLOCK_NAME,
			blockVersion: RELATIONSHIP_RULES_BLOCK_VERSION,
			identity: sourceIdentity,
			output: getRelationshipRulesArtifactOutput({
				output: { rules: [rule] },
			}),
			readyAt: new Date(),
		})

		const currentRelationships = await getReadyRelationshipRulesInvolving({
			ref,
			provider,
			kind: "resource",
			type: "aws_vpc",
			schema: buildFieldTree(vpcSchema),
			schemaHash: selfSchemaHash,
		})

		expect(currentRelationships).toHaveLength(1)
		expect(currentRelationships[0]).toMatchObject({
			source: rule.source,
			target: rule.target,
			relationship: "ATTACHMENT",
		})
	})

	test("ready relationship query includes the current type artifact", async () => {
		const schemaHash = hashResourceSchema(vpcSchema)
		const rule = {
			source: {
				kind: "resource",
				type: "aws_internet_gateway",
				path: "vpc_id",
			},
			target: { kind: "resource", type: "aws_vpc", path: "id" },
			relationship: "ATTACHMENT",
		} satisfies RelationshipRulesLlmOutput["rules"][number]
		const identity = ["aws", "resource", "aws_vpc", schemaHash].join(":")
		const artifact = await thinkingBlockStore.createArtifact({
			blockName: RELATIONSHIP_RULES_BLOCK_NAME,
			blockVersion: RELATIONSHIP_RULES_BLOCK_VERSION,
			identity,
			input: { type: "aws_vpc" },
			createdAt: new Date(),
		})
		await thinkingBlockStore.markArtifactReady({
			artifactId: artifact.id,
			blockName: RELATIONSHIP_RULES_BLOCK_NAME,
			blockVersion: RELATIONSHIP_RULES_BLOCK_VERSION,
			identity,
			output: getRelationshipRulesArtifactOutput({
				output: { rules: [rule] },
			}),
			readyAt: new Date(),
		})

		const currentRelationships = await getReadyRelationshipRulesInvolving({
			ref,
			provider,
			kind: "resource",
			type: "aws_vpc",
			schema: buildFieldTree(vpcSchema),
			schemaHash,
		})

		expect(currentRelationships).toMatchObject([
			{
				source: rule.source,
				target: rule.target,
				relationship: "ATTACHMENT",
			},
		])
	})

	test("ready relationship query reads the latest ready artifact for the block version", async () => {
		const sourceSchemaHash = hashResourceSchema(gatewaySchema)
		const selfSchemaHash = hashResourceSchema(vpcSchema)
		const rule = {
			source: {
				kind: "resource",
				type: "aws_internet_gateway",
				path: "vpc_id",
			},
			target: { kind: "resource", type: "aws_vpc", path: "id" },
			relationship: "ATTACHMENT",
		} satisfies RelationshipRulesLlmOutput["rules"][number]
		const oldOutput = getRelationshipRulesArtifactOutput({
			output: { rules: [rule] },
		})
		const newOutput = getRelationshipRulesArtifactOutput({
			output: { rules: [rule] },
		})
		expect(oldOutput.rules[0].key).toBe(newOutput.rules[0].key)

		for (const [label, output] of [
			["old", oldOutput],
			["new", newOutput],
		] as const) {
			const identity = [
				"aws",
				"resource",
				"aws_internet_gateway",
				sourceSchemaHash,
			].join(":")
			const artifact = await thinkingBlockStore.createArtifact({
				blockName: RELATIONSHIP_RULES_BLOCK_NAME,
				blockVersion: RELATIONSHIP_RULES_BLOCK_VERSION,
				identity,
				input: { type: "aws_internet_gateway", label },
				createdAt: new Date(),
			})
			await thinkingBlockStore.markArtifactReady({
				artifactId: artifact.id,
				blockName: RELATIONSHIP_RULES_BLOCK_NAME,
				blockVersion: RELATIONSHIP_RULES_BLOCK_VERSION,
				identity,
				output,
				readyAt: new Date(),
			})
		}

		const currentRelationships = await getReadyRelationshipRulesInvolving({
			ref,
			provider,
			kind: "resource",
			type: "aws_vpc",
			schema: buildFieldTree(vpcSchema),
			schemaHash: selfSchemaHash,
		})

		expect(currentRelationships).toHaveLength(1)
		expect(currentRelationships[0]).toMatchObject({
			key: newOutput.rules[0].key,
		})
	})
})

function mockModel(outputs: string[]) {
	const queue = [...outputs]
	return new MockLanguageModelV3({
		provider: "mock",
		modelId: "mock-model",
		doGenerate: async () => mockTextResult(queue.shift() ?? "{}"),
	})
}

function mockTextResult(text: string): MockGenerateResult {
	return {
		content: [{ type: "text", text }],
		finishReason: { unified: "stop", raw: "stop" },
		usage: {
			inputTokens: {
				total: 1,
				noCache: 1,
				cacheRead: 0,
				cacheWrite: 0,
			},
			outputTokens: {
				total: 1,
				text: 1,
				reasoning: 0,
			},
		},
		response: {
			modelId: "mock-model",
		},
		warnings: [],
	}
}
