import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { CompactChangeSummary, FieldLevelDiff } from "@/components/ChangeReview"
import { DryRunChip, DryRunErrorNote } from "@/components/DryRunChip"
import { resolveItemDiff } from "@/components/resource-sheet/itemDiff"
import { Button } from "@/components/ui/button"
import {
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet"
import { renderTaggedError } from "@/errors/error-toast"
import {
	type ChangeSetItem,
	deleteChangeSetItemMutationOptions,
	dryRunQueryOptions,
	type ResourceDryRun,
} from "@/lib/changeSetReactQuery"
import { queryClient } from "@/lib/query"

export function StagedChangeBody({
	projectSlug,
	changeSetId,
	stagedItem,
	onClose,
}: {
	projectSlug: string
	changeSetId?: string | null
	stagedItem: ChangeSetItem
	onClose: () => void
}) {
	const { data: dryRun = null } = useQuery(
		dryRunQueryOptions({
			projectSlug,
			changeSetId: changeSetId ?? "",
			itemId: stagedItem.id,
			initialData: stagedItem.dryRun,
			enabled: !!changeSetId,
		}),
	)
	const removeMutation = useMutation({
		...deleteChangeSetItemMutationOptions({
			projectSlug,
			id: changeSetId ?? "",
			queryClient,
		}),
		onSuccess: () => {
			toast.success("Staged change removed")
			onClose()
		},
		onError: (e) => renderTaggedError(toast, e),
	})

	return (
		<div className="flex h-full flex-col">
			<SheetHeader>
				<SheetTitle>Staged change</SheetTitle>
				<SheetDescription>
					Review this change before it is deployed.
				</SheetDescription>
			</SheetHeader>
			<div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
				<CompactChangeSummary
					item={stagedItem}
					statusSlot={<DryRunChip dryRun={dryRun} />}
				/>
				<DryRunErrorNote dryRun={dryRun} />
				<ChangeDetail item={stagedItem} dryRun={dryRun} />
			</div>
			<SheetFooter className="flex-row items-center justify-end gap-2 border-t px-4 py-3">
				<Button type="button" variant="ghost" size="sm" onClick={onClose}>
					Close
				</Button>
				<Button
					type="button"
					variant="destructive"
					size="sm"
					onClick={() => removeMutation.mutate(stagedItem.id)}
					disabled={removeMutation.isPending || !changeSetId}
				>
					Remove staged change
				</Button>
			</SheetFooter>
		</div>
	)
}

export function ChangeDetail({
	item,
	dryRun,
}: {
	item: ChangeSetItem
	dryRun: ResourceDryRun | null
}) {
	const diff = resolveItemDiff(item, dryRun)
	if (diff.kind === "destroy") {
		return (
			<div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm">
				{diff.mode === "forget" ? (
					<>
						Opsy will <span className="font-medium">stop tracking</span> this
						resource. The real infrastructure is left untouched.
					</>
				) : (
					<>
						This resource will be{" "}
						<span className="font-medium text-destructive">
							permanently destroyed
						</span>{" "}
						when the change is deployed.
					</>
				)}
			</div>
		)
	}
	return (
		<div className="grid gap-2">
			{diff.status === "computing" && (
				<div className="text-xs text-muted-foreground italic">
					Computing dry run…
				</div>
			)}
			<FieldLevelDiff
				before={diff.before}
				after={diff.after}
				resourceType={item.resourceType}
				requiresReplace={
					item.kind === "update_resource" ? dryRun?.requiresReplace : null
				}
			/>
		</div>
	)
}
