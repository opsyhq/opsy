import { beforeEach, describe, expect, it } from "vitest"
import { useRelatedCreateStore } from "./-relatedCreateStore"

describe("related-create store", () => {
	beforeEach(() => {
		useRelatedCreateStore.getState().reset()
	})

	it("starts empty", () => {
		expect(useRelatedCreateStore.getState().state).toBeNull()
	})

	it("tracks the source while staging the target", () => {
		useRelatedCreateStore.getState().start({
			targetEndpoint: { type: "aws_subnet", path: "id" },
			source: {
				kind: "staged",
				stagedItemId: "source",
				fieldPath: "subnet_id",
				cardinality: "one",
				changes: {
					type: "aws_instance",
					slug: "instance",
					inputs: {},
				},
				returnMode: "create",
			},
		})

		expect(useRelatedCreateStore.getState().state).toMatchObject({
			targetEndpoint: { type: "aws_subnet", path: "id" },
			source: { kind: "staged", stagedItemId: "source", returnMode: "create" },
			step: "creating-target",
		})

		useRelatedCreateStore.getState().setTargetStagedItem("target")

		expect(useRelatedCreateStore.getState().state).toMatchObject({
			targetStagedItemId: "target",
			step: "creating-target",
		})
	})

	it("marks returning to guard the async return-to-source window", () => {
		useRelatedCreateStore.getState().start({
			targetEndpoint: { type: "aws_subnet", path: "id" },
			source: {
				kind: "live",
				resourceSlug: "src",
				fieldPath: "subnet_id",
				cardinality: "one",
				values: {},
			},
		})
		useRelatedCreateStore.getState().setTargetStagedItem("target")
		useRelatedCreateStore.getState().markReturning()

		expect(useRelatedCreateStore.getState().state).toMatchObject({
			step: "returning",
		})
	})

	it("clears the state", () => {
		useRelatedCreateStore.getState().start({
			targetEndpoint: { type: "aws_subnet", path: "id" },
			source: {
				kind: "live",
				resourceSlug: "src",
				fieldPath: "subnet_id",
				cardinality: "one",
				values: {},
			},
		})
		useRelatedCreateStore.getState().clear()
		expect(useRelatedCreateStore.getState().state).toBeNull()
	})
})
