import { describe, expect, it } from "vitest"
import type { ChangeSetItem } from "@/lib/changeSetReactQuery"
import { buildResourceSheetModel } from "./-ResourceSheet.logic"

const baseItem = {
	id: "item-1",
	kind: "create_resource",
	targetResourceSlug: null,
	resourceType: null,
	changes: {
		kind: "resource",
		type: "aws_subnet",
		slug: "subnet-a",
		inputs: {},
	},
	source: "user",
	createdAt: "2026-05-11T00:00:00.000Z",
	dryRun: null,
	validationStatus: "valid",
	validationResult: null,
	applyStatus: "pending",
	applyError: null,
} satisfies ChangeSetItem

describe("ResourceSheet.logic", () => {
	it("keeps the create flow open only for freshly-created staged resources", () => {
		const model = buildResourceSheetModel({
			target: { stagedItemId: "item-1", mode: "create" },
			items: [baseItem],
		})

		expect(model.open).toBe(true)
		expect(model.stagedProviderItem).toBe(baseItem)
		expect(model.showProviderDetail).toBe(false)
		expect(model.providerPanelTitle).toBe("Create Resource")
	})

	it("routes an existing staged provider item to resource detail edit mode", () => {
		const model = buildResourceSheetModel({
			target: { stagedItemId: "item-1", mode: "detail" },
			items: [baseItem],
		})

		expect(model.stagedProviderItem).toBe(baseItem)
		expect(model.showProviderDetail).toBe(true)
		expect(model.providerPanelTitle).toBe("Resource Detail")
	})

	it("keeps empty staged resources on the legacy sheet path", () => {
		const emptyItem = {
			...baseItem,
			id: "empty-1",
			changes: { slug: "box" },
		} satisfies ChangeSetItem
		const model = buildResourceSheetModel({
			target: { stagedItemId: "empty-1", mode: "detail" },
			items: [emptyItem],
		})

		expect(model.stagedEmptyItem).toBe(emptyItem)
		expect(model.stagedProviderItem).toBe(null)
		expect(model.showProviderDetail).toBe(false)
	})
})
