import { describe, expect, it } from "vitest"
import { canvasModel } from "@/components/canvas/canvasModel"
import type { ResourceLike } from "@/components/project-canvas/resourceProjection"
import { toFlowNodes } from "@/components/project-canvas/toFlowNodes"
import type { ChangeSet, ChangeSetItem } from "@/lib/changeSetReactQuery"

const baseResource: ResourceLike = {
	id: "target-id",
	slug: "target",
	type: "aws_instance",
	status: "live",
	provider: "aws",
	inputs: { name: "target" },
	position: { x: 0, y: 0 },
	size: null,
	references: [],
}

function resource(
	slug: string,
	overrides: Partial<ResourceLike> = {},
): ResourceLike {
	return {
		...baseResource,
		id: `${slug}-id`,
		slug,
		...overrides,
	}
}

function changeSetItem(overrides: Partial<ChangeSetItem>): ChangeSetItem {
	return {
		id: "stage-item",
		kind: "update_resource",
		targetResourceSlug: "target",
		resourceType: "aws_instance",
		changes: {},
		source: "user",
		createdAt: "2026-01-01T00:00:00.000Z",
		dryRun: null,
		validationStatus: "valid",
		validationResult: null,
		applyStatus: "pending",
		applyError: null,
		...overrides,
	}
}

function draftChangeSet(items: ChangeSetItem[]): ChangeSet {
	return {
		id: "draft-cs",
		status: "draft",
		title: null,
		items,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	}
}

describe("canvasModel", () => {
	it("overlays staged create resources with references from staged inputs", () => {
		const model = canvasModel({
			appliedResources: [resource("source")],
			draft: draftChangeSet([
				changeSetItem({
					id: "create-draft",
					kind: "create_resource",
					targetResourceSlug: null,
					changes: {
						kind: "resource",
						slug: "draft",
						type: "aws_instance",
						inputs: { source_id: { $ref: "source.id" } },
					},
				}),
			]),
			applying: [],
			openOperations: [],
			rulesByTypeKey: new Map(),
			displayByTypeKey: new Map(),
		})

		expect(model.resources.map((r) => r.slug).sort()).toEqual([
			"draft",
			"source",
		])
		const draft = model.resources.find((r) => r.slug === "draft")
		expect(draft?.references).toEqual([
			{ sourcePath: "source_id", targetSlug: "source", targetPath: "id" },
		])
	})

	it("recomputes references when staged inputs change", () => {
		const model = canvasModel({
			appliedResources: [
				resource("target", {
					inputs: { input: { $ref: "old-source.id" } },
					references: [
						{ sourcePath: "input", targetSlug: "old-source", targetPath: "id" },
					],
				}),
				resource("old-source"),
				resource("new-source"),
			],
			draft: draftChangeSet([
				changeSetItem({
					changes: { inputs: { input: { $ref: "new-source.id" } } },
				}),
			]),
			applying: [],
			openOperations: [],
			rulesByTypeKey: new Map(),
			displayByTypeKey: new Map(),
		})

		const target = model.resources.find((r) => r.slug === "target")
		expect(target?.inputs).toEqual({ input: { $ref: "new-source.id" } })
		expect(target?.references).toEqual([
			{ sourcePath: "input", targetSlug: "new-source", targetPath: "id" },
		])
	})

	it("leaves references unchanged for layout-only updates", () => {
		const target = resource("target", {
			inputs: { input: { $ref: "source.id" } },
			references: [
				{ sourcePath: "input", targetSlug: "source", targetPath: "id" },
			],
		})
		const model = canvasModel({
			appliedResources: [target, resource("source")],
			draft: draftChangeSet([
				changeSetItem({ changes: { position: { x: 42, y: 84 } } }),
			]),
			applying: [],
			openOperations: [],
			rulesByTypeKey: new Map(),
			displayByTypeKey: new Map(),
		})

		const stagedTarget = model.resources.find((r) => r.slug === "target")
		expect(stagedTarget?.references).toEqual(target.references)
		expect(stagedTarget?.position).toEqual({ x: 42, y: 84 })
	})

	it("preserves staged delete node marking", () => {
		const model = canvasModel({
			appliedResources: [resource("target"), resource("source")],
			draft: draftChangeSet([
				changeSetItem({
					id: "delete-stage",
					kind: "delete_resource",
					targetResourceSlug: "target",
					changes: { mode: "forget" },
				}),
			]),
			applying: [],
			openOperations: [],
			rulesByTypeKey: new Map(),
			displayByTypeKey: new Map(),
		})

		const nodes = toFlowNodes({
			resources: model.resources,
			stagedUpdatesBySlug: model.stagedUpdatesBySlug,
			displayByTypeKey: new Map(),
		})
		const target = nodes.find((node) => node.id === "target")

		expect(target?.data.staged).toBe(true)
		expect(target?.data.stageKind).toBe("delete_resource")
		expect(target?.data.stageAction).toBe("Forget staged")
	})

	it("normalizes applied resources and projects relationships", () => {
		const model = canvasModel({
			appliedResources: [
				{
					id: "instance-id",
					slug: "instance",
					type: "aws_instance",
					provider: "aws",
					status: "live",
					inputs: { name: "instance" },
					position: { x: 0, y: 0 },
					size: null,
					metadata: {},
					references: [
						{
							sourcePath: "security_group_ids",
							targetSlug: "security-group",
							targetPath: "id",
						},
					],
				},
				{
					id: "sg-id",
					slug: "security-group",
					type: "aws_security_group",
					provider: "aws",
					status: "live",
					inputs: null,
					position: { x: 0, y: 0 },
					size: null,
					metadata: {},
					references: [],
				},
			],
			draft: null,
			applying: [],
			openOperations: [],
			rulesByTypeKey: new Map(),
			displayByTypeKey: new Map(),
		})

		expect(model.resources.find((r) => r.slug === "instance")).toMatchObject({
			inputs: { name: "instance" },
		})
		expect(model.hiddenRelationshipSlugs).toEqual(new Set())
		expect(model.activeItems).toEqual([])
		expect(model.stagedUpdatesBySlug).toEqual(new Map())
		expect(model.resourceEdges.map((edge) => edge.id)).toEqual([
			"config|instance|security-group|security_group_ids|id|REFERENCE",
		])
	})
})
