import { describe, expect, it } from "vitest"
import type { CanvasEdge } from "@/components/project-canvas/resourceRelationships"
import type { DisplayByTypeKey, ResourceDisplayMode } from "./nodeFootprint"
import { applyRelationshipProjection } from "./relationshipProjection"
import type { ResourceLike } from "./resourceProjection"

const baseResource: ResourceLike = {
	id: "resource-1",
	slug: "resource-1",
	type: "aws_instance",
	status: "live",
	provider: "aws",
	inputs: null,
	position: null,
	size: null,
	references: [],
}

function resource(slug: string, type = "aws_instance"): ResourceLike {
	return {
		...baseResource,
		id: slug,
		slug,
		type,
	}
}

function displayMap(
	entries: Record<string, ResourceDisplayMode>,
): DisplayByTypeKey {
	return new Map(
		Object.entries(entries).map(([type, mode]) => [
			`aws:resource:${type}`,
			mode,
		]),
	)
}

function edge(
	id: string,
	source: string,
	target: string,
	role: CanvasEdge["role"],
): CanvasEdge {
	return {
		id,
		source,
		target,
		role,
		origin: "rule",
		sourcePath: "id",
		targetPath: "id",
		ruleKey: `rule-${id}`,
		referrerSlug: source,
	}
}

describe("relationship projection", () => {
	it("keeps resources flat for references", () => {
		const result = applyRelationshipProjection(
			[resource("instance"), resource("security-group")],
			[
				edge(
					"instance-security-group",
					"instance",
					"security-group",
					"REFERENCE",
				),
			],
			displayMap({}),
		)

		expect(result.hiddenSlugs).toEqual(new Set())
		expect(result.resources.map((item) => item.slug)).toEqual([
			"instance",
			"security-group",
		])
		expect(result.consumedDisplayEdgeIds).toEqual(new Set())
	})

	it("keeps scoped resources flat and undocked", () => {
		const result = applyRelationshipProjection(
			[resource("workload"), resource("network-boundary")],
			[edge("workload-boundary", "workload", "network-boundary", "SCOPE")],
			displayMap({}),
		)

		expect(result.hiddenSlugs).toEqual(new Set())
		expect(result.collapsedRelationships).toEqual([])
		expect(result.consumedDisplayEdgeIds).toEqual(new Set())
		expect(
			result.resources.find((item) => item.slug === "workload"),
		).toMatchObject({
			componentHostSlug: null,
			bottomTuckedItems: [],
		})
		expect(
			result.resources.find((item) => item.slug === "network-boundary"),
		).toMatchObject({
			componentHostSlug: null,
			bottomTuckedItems: [],
		})
	})

	it("docks one-host chip attachments under the host card", () => {
		const result = applyRelationshipProjection(
			[resource("alb"), resource("listener", "aws_lb_listener")],
			[edge("listener-alb", "listener", "alb", "ATTACHMENT")],
			displayMap({ aws_lb_listener: "chip" }),
		)

		expect(result.hiddenSlugs).toEqual(new Set())
		expect(result.consumedDisplayEdgeIds).toEqual(new Set())
		expect(result.resources.find((item) => item.slug === "alb")).toMatchObject({
			bottomTuckedItems: [expect.objectContaining({ slug: "listener" })],
		})
		expect(
			result.resources.find((item) => item.slug === "listener"),
		).toMatchObject({
			componentHostSlug: "alb",
		})
	})

	it("docks chip attachments with duplicate identity edges to the same host", () => {
		const bucketPolicy = resource("bucket-policy", "aws_s3_bucket_policy")
		const bucketByName = {
			...edge("policy-bucket-name", "bucket-policy", "bucket", "ATTACHMENT"),
			sourcePath: "bucket",
			targetPath: "bucket",
		}
		const bucketById = {
			...edge("policy-bucket-id", "bucket-policy", "bucket", "ATTACHMENT"),
			sourcePath: "bucket",
			targetPath: "id",
		}
		const result = applyRelationshipProjection(
			[resource("bucket"), bucketPolicy],
			[bucketByName, bucketById],
			displayMap({ aws_s3_bucket_policy: "chip" }),
		)

		expect(
			result.resources.find((item) => item.slug === "bucket"),
		).toMatchObject({
			bottomTuckedItems: [expect.objectContaining({ slug: "bucket-policy" })],
		})
		expect(
			result.resources.find((item) => item.slug === "bucket-policy"),
		).toMatchObject({
			componentHostSlug: "bucket",
		})
	})

	it("keeps chip attachments flat when they attach to multiple hosts", () => {
		const result = applyRelationshipProjection(
			[
				resource("policy", "aws_s3_bucket_policy"),
				resource("bucket-a"),
				resource("bucket-b"),
			],
			[
				edge("policy-bucket-a", "policy", "bucket-a", "ATTACHMENT"),
				edge("policy-bucket-b", "policy", "bucket-b", "ATTACHMENT"),
			],
			displayMap({ aws_s3_bucket_policy: "chip" }),
		)

		expect(
			result.resources.find((item) => item.slug === "policy"),
		).toMatchObject({
			componentHostSlug: null,
			bottomTuckedItems: [],
		})
		expect(
			result.resources.find((item) => item.slug === "bucket-a"),
		).toMatchObject({
			bottomTuckedItems: [],
		})
	})

	it("keeps card attachments as quiet edges", () => {
		const result = applyRelationshipProjection(
			[resource("instance"), resource("volume")],
			[edge("volume-instance", "volume", "instance", "ATTACHMENT")],
			displayMap({}),
		)

		expect(result.hiddenSlugs).toEqual(new Set())
		expect(result.consumedDisplayEdgeIds).toEqual(new Set())
		expect(
			result.resources.find((item) => item.slug === "volume"),
		).toBeDefined()
	})

	it("collapses explicit association resources into inspectable connectors", () => {
		const result = applyRelationshipProjection(
			[
				resource("association", "aws_route_table_association"),
				resource("route-table"),
				resource("subnet"),
			],
			[
				edge("association-rt", "association", "route-table", "ASSOCIATION"),
				edge("association-subnet", "association", "subnet", "ASSOCIATION"),
			],
			displayMap({ aws_route_table_association: "chip" }),
		)

		expect(result.hiddenSlugs).toEqual(new Set(["association"]))
		expect(result.collapsedRelationships).toEqual([
			expect.objectContaining({
				sourceSlug: "route-table",
				targetSlug: "subnet",
				underlyingEdgeIds: ["association-rt", "association-subnet"],
				hiddenResourceSlugs: ["association"],
			}),
		])
	})

	it("keeps one-ended association resources visible", () => {
		const result = applyRelationshipProjection(
			[
				resource("association", "aws_route_table_association"),
				resource("subnet"),
			],
			[edge("association-subnet", "association", "subnet", "ASSOCIATION")],
			displayMap({ aws_route_table_association: "chip" }),
		)

		expect(result.hiddenSlugs).toEqual(new Set())
		expect(result.collapsedRelationships).toEqual([])
	})

	it("keeps relationships from docked attachment chips inspectable", () => {
		const result = applyRelationshipProjection(
			[
				resource("alb"),
				resource("listener", "aws_lb_listener"),
				resource("target-group"),
			],
			[
				edge("listener-alb", "listener", "alb", "ATTACHMENT"),
				edge("listener-target", "listener", "target-group", "REFERENCE"),
			],
			displayMap({ aws_lb_listener: "chip" }),
		)

		expect(result.hiddenSlugs).toEqual(new Set())
		expect(result.collapsedRelationships).toEqual([])
		expect(
			result.resources.find((item) => item.slug === "listener"),
		).toMatchObject({
			componentHostSlug: "alb",
		})
	})
})
