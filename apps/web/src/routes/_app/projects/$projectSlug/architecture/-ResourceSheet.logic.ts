import { isCreateLikeStagedItem } from "@/components/resource-sheet/shared"
import { type ChangeSetItem, changesRecord } from "@/lib/changeSetReactQuery"
import type { ResourceDraft } from "./-resourceDraftStore"

export type ResourceSheetTarget =
	| null
	| { kind?: undefined; stagedItemId: string; mode?: "create" | "detail" }
	| { kind: "draft"; draft: ResourceDraft }

type ResourceSheetModel = {
	open: boolean
	stagedItemId: string | null
	createFlowOpen: boolean
	stagedItem: ChangeSetItem | null
	stagedCreateItem: ChangeSetItem | null
	stagedEmptyItem: ChangeSetItem | null
	stagedProviderItem: ChangeSetItem | null
	showProviderDetail: boolean
	providerPanelTitle: "Create Resource" | "Resource Detail"
	// Local-only draft: editor renders with these initial values and stages
	// the resource only when the user submits Save.
	resourceDraft: ResourceDraft | null
}

export function buildResourceSheetModel({
	target,
	items,
}: {
	target: ResourceSheetTarget
	items: ChangeSetItem[]
}): ResourceSheetModel {
	const open = target !== null
	const resourceDraft = target && target.kind === "draft" ? target.draft : null
	const stagedItemId =
		target && target.kind !== "draft" ? (target.stagedItemId ?? null) : null
	const createFlowOpen =
		!!resourceDraft ||
		(target && target.kind !== "draft" && target.mode === "create") ||
		false
	const stagedItem = stagedItemId
		? (items.find((item) => item.id === stagedItemId) ?? null)
		: null
	const stagedCreateItem =
		stagedItem && isCreateLikeStagedItem(stagedItem) ? stagedItem : null
	const stagedCreateAfter = stagedCreateItem
		? changesRecord(stagedCreateItem)
		: null
	const stagedEmptyItem =
		stagedCreateItem && typeof stagedCreateAfter?.type !== "string"
			? stagedCreateItem
			: null
	const stagedProviderItem =
		stagedCreateItem && typeof stagedCreateAfter?.type === "string"
			? stagedCreateItem
			: null
	const showProviderDetail = !!stagedProviderItem && !createFlowOpen

	return {
		open,
		stagedItemId,
		createFlowOpen,
		stagedItem,
		stagedCreateItem,
		stagedEmptyItem,
		stagedProviderItem,
		showProviderDetail,
		providerPanelTitle: showProviderDetail
			? "Resource Detail"
			: "Create Resource",
		resourceDraft,
	}
}
