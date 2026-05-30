import { describe, expect, it } from "vitest"
import {
	resourceTypeSearchQueryOptions,
	typeArtifactsQueryOptions,
} from "./providerReactQuery"

describe("resource type search queries", () => {
	it("polls while search result artifacts are pending", () => {
		const options = resourceTypeSearchQueryOptions({
			provider: "fake",
		})
		const refetchInterval = options.refetchInterval
		if (typeof refetchInterval !== "function") {
			throw new Error("expected refetchInterval")
		}

		expect(
			refetchInterval({
				state: {
					data: {
						pages: [
							{
								results: [
									{
										artifacts: {
											icon: null,
											metadata: { status: "pending" },
										},
									},
								],
							},
						],
					},
				},
			} as never),
		).toBe(2000)
		expect(
			refetchInterval({
				state: {
					data: {
						pages: [
							{
								results: [
									{
										artifacts: {
											icon: { status: null },
											metadata: { status: "ready" },
										},
									},
								],
							},
						],
					},
				},
			} as never),
		).toBe(false)
	})
})

describe("type artifacts queries", () => {
	it("polls while any artifact in the bundle is pending", () => {
		const options = typeArtifactsQueryOptions({
			provider: "fake",
			type: "fake_instance",
			kind: "resource",
		})
		const refetchInterval = options.refetchInterval
		if (typeof refetchInterval !== "function") {
			throw new Error("expected refetchInterval")
		}

		expect(options.staleTime).toBe(Number.POSITIVE_INFINITY)
		expect(
			refetchInterval({
				state: {
					data: {
						icon: { status: null },
						metadata: { status: null },
						fieldMetadata: { status: "pending" },
						relationshipRules: { status: null },
						fieldLayout: { status: null },
					},
				},
			} as never),
		).toBe(2000)
		expect(
			refetchInterval({
				state: {
					data: {
						icon: { status: null },
						metadata: { status: null },
						fieldMetadata: { status: "ready" },
						relationshipRules: { status: null },
						fieldLayout: { status: null },
					},
				},
			} as never),
		).toBe(false)
	})
})
