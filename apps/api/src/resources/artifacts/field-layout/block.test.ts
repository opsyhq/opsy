import { beforeAll, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { buildFieldTree, type ResourceSchema } from "@opsy/provider"
import { Output, ToolLoopAgent } from "ai"
import { MockLanguageModelV3 } from "ai/test"
import { migrate } from "@/lib/db/migrate"
import { ThinkingBlock } from "@opsy/thinking-blocks"
import { thinkingBlockStore } from "@/thinking-blocks"
import {
	RESOURCE_FIELD_LAYOUT_BLOCK_NAME,
	RESOURCE_FIELD_LAYOUT_BLOCK_VERSION,
	RESOURCE_FIELD_LAYOUT_CANDIDATE_MODEL,
	RESOURCE_FIELD_LAYOUT_MODEL,
	type ResourceFieldLayoutInput,
	type ResourceFieldLayoutLlmOutput,
	resourceFieldLayoutInput,
	resourceFieldLayoutLlmSchema,
	resourceFieldLayoutPrompt,
} from "./block"
import { resourceFieldLayoutValidator } from "./validators"

type MockGenerateResult = Awaited<ReturnType<MockLanguageModelV3["doGenerate"]>>

function schema(block: NonNullable<ResourceSchema["block"]>) {
	return buildFieldTree({ version: 0, block })
}

const baseInput = resourceFieldLayoutInput({
	provider: "aws",
	kind: "resource",
	type: "aws_subnet",
	schema: schema({
		attributes: {
			cidr_block: { type: "string", required: true },
			vpc_id: { type: "string", required: true },
			availability_zone: { type: "string", optional: true },
			tags: { type: ["map", "string"], optional: true },
			id: { type: "string", computed: true },
		},
		block_types: {
			timeouts: {
				nesting_mode: "list",
				max_items: 1,
				block: {
					attributes: {
						create: { type: "string", optional: true },
						delete: { type: "string", optional: true },
					},
				},
			},
		},
	}),
	schemaHash: "hash",
})

const generatedLayout: ResourceFieldLayoutLlmOutput = {
	create: { title: "Create subnet", rows: ["vpc_id", "cidr_block"] },
	sections: [
		{
			title: "Details",
			rows: [
				"vpc_id",
				"cidr_block",
				"availability_zone",
				"tags",
				"id",
				"timeouts",
			],
		},
	],
}

beforeAll(async () => {
	await migrate()
})

describe("field-layout block", () => {
	test("keeps one fixed model constant until a candidate is promoted", () => {
		expect(RESOURCE_FIELD_LAYOUT_MODEL).toBe("gpt-5.4")
		expect(RESOURCE_FIELD_LAYOUT_CANDIDATE_MODEL).toBe("gpt-5.4")
	})

	test("block name and version are pinned", () => {
		expect(RESOURCE_FIELD_LAYOUT_BLOCK_NAME).toBe("resource-field-layout")
		expect(RESOURCE_FIELD_LAYOUT_BLOCK_VERSION).toBe("v2")
	})

	test("prompt carries the supplied field records and no type leak", () => {
		const prompt = resourceFieldLayoutPrompt(baseInput)
		expect(prompt).toContain(
			"Can you please arrange this resource form into a create section and edit sections",
		)
		expect(prompt).not.toContain("aws_subnet")

		const context = JSON.parse(
			prompt.match(/```json\n([\s\S]*)\n```/)?.[1] ?? "null",
		)
		expect(context.validationFeedback).toEqual([])
		expect(context.fields).toEqual(baseInput.fields)
		expect(context.fields.map((field: { path: string }) => field.path)).toEqual(
			[
				"cidr_block",
				"vpc_id",
				"availability_zone",
				"tags",
				"id",
				"timeouts",
				"timeouts.create",
				"timeouts.delete",
			],
		)
	})

	test("prompt threads validation feedback back to the model", () => {
		const prompt = resourceFieldLayoutPrompt(baseInput, {
			issues: [{ path: "sections", message: "unplaced" }],
		})
		const context = JSON.parse(
			prompt.match(/```json\n([\s\S]*)\n```/)?.[1] ?? "null",
		)
		expect(context.validationFeedback).toEqual([
			{ issues: [{ path: "sections", message: "unplaced" }] },
		])
	})

	test("mocked agent block run generates, validates, and reads back the layout", async () => {
		const model = mockModel([JSON.stringify(generatedLayout)])
		const block = new ThinkingBlock<
			ResourceFieldLayoutInput,
			ResourceFieldLayoutLlmOutput
		>({
			agent: new ToolLoopAgent({
				id: "field-layout-mock-generator",
				model,
				output: Output.object({ schema: resourceFieldLayoutLlmSchema }),
			}),
			name: `resource-field-layout-mock-${randomUUID()}`,
			store: thinkingBlockStore,
			identity: (input) =>
				[input.provider, input.kind, input.type, input.schemaHash].join(":"),
			prepareCall: ({ input, feedback }) => ({
				prompt: resourceFieldLayoutPrompt(input, feedback),
			}),
			validators: [resourceFieldLayoutValidator],
		})

		try {
			const result = await block.generate({
				...baseInput,
				schemaHash: `hash-${randomUUID()}`,
			})

			expect(result.ok).toBe(true)
			if (!result.ok) throw new Error("expected generated layout")
			expect(result.output).toEqual(generatedLayout)
		} finally {
			block.stop()
		}
	})

	test("schema rejects extra keys instead of stripping them", () => {
		expect(
			resourceFieldLayoutLlmSchema.safeParse({
				create: { title: "Create", rows: [] },
				sections: [],
				extra: true,
			}).success,
		).toBe(false)
		expect(
			resourceFieldLayoutLlmSchema.safeParse({
				create: { title: "Create", rows: [] },
				sections: [
					{ title: "Details", rows: [{ title: "G", rows: [], widget: "x" }] },
				],
			}).success,
		).toBe(false)
		expect(
			resourceFieldLayoutLlmSchema.safeParse(generatedLayout).success,
		).toBe(true)
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
			inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
			outputTokens: { total: 1, text: 1, reasoning: 0 },
		},
		response: { modelId: "mock-model" },
		warnings: [],
	}
}
