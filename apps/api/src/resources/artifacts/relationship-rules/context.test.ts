import { describe, expect, test } from "bun:test"
import {
	buildFieldTree,
	type OpsyProvider,
	type ResourceSchema,
} from "@opsy/provider"
import { getProviderTypeSchema, searchProviderTypes } from "./context"

const resourceSchema = {
	version: 0,
	block: {
		attributes: {
			id: { type: "string", computed: true },
		},
	},
} satisfies ResourceSchema

const dataSchema = {
	version: 0,
	block: {
		attributes: {
			instance_id: { type: "string", computed: true },
		},
	},
} satisfies ResourceSchema

function mockProvider(
	calls: Array<Parameters<OpsyProvider["searchTypes"]>[0]> = [],
): OpsyProvider {
	return {
		searchTypes: async (input) => {
			calls.push(input)
			return {
				results: [
					{ type: "aws_instance", kinds: ["resource", "data"] },
					{ type: "aws_ami", kinds: ["data"] },
					{ type: "aws_vpc", kinds: ["resource"] },
				],
				truncated: false,
			}
		},
		getSchema: async (type, kind) => {
			if (type === "aws_instance" && kind === "resource")
				return buildFieldTree(resourceSchema)
			if (type === "aws_instance" && kind === "data")
				return buildFieldTree(dataSchema)
			if (type === "aws_ami" && kind === "data")
				return buildFieldTree(dataSchema)
			if (type === "aws_vpc" && kind === "resource")
				return buildFieldTree(resourceSchema)
			return undefined
		},
	} as OpsyProvider
}

describe("relationship rule provider context", () => {
	test("delegates bounded search to the provider", async () => {
		const calls: Array<Parameters<OpsyProvider["searchTypes"]>[0]> = []
		const results = await searchProviderTypes({
			provider: mockProvider(calls),
			query: "instance",
			kind: "data",
			limit: 10,
		})

		expect(calls).toEqual([{ q: "instance", kind: "data", limit: 10 }])
		expect(results).toContainEqual({ type: "aws_instance", kind: "data" })
	})

	test("keeps provider-ranked data-only targets available", async () => {
		const results = await searchProviderTypes({
			provider: mockProvider(),
			query: "ami",
			kind: "data",
			limit: 10,
		})

		expect(results).toContainEqual({ type: "aws_ami", kind: "data" })
	})

	test("inspects one selected schema", async () => {
		expect(
			await getProviderTypeSchema({
				provider: mockProvider(),
				type: "aws_instance",
				kind: "resource",
			}),
		).toMatchObject({
			type: "aws_instance",
			kind: "resource",
			fields: [{ path: "id" }],
		})
	})
})
