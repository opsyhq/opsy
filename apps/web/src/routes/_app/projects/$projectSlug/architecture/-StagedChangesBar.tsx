import { useMutation, useQuery } from "@tanstack/react-query"
import { Loader2, RefreshCw, Trash2, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { CompactChangeSummary } from "@/components/ChangeReview"
import { DryRunChip, DryRunErrorNote } from "@/components/DryRunChip"
import { ChangeDetail } from "@/components/resource-sheet/StagedChangeBody"
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet"
import {
	applyChangeSetMutationOptions,
	type ChangeSet,
	type ChangeSetItem,
	deleteChangeSetItemMutationOptions,
	discardChangeSetMutationOptions,
	dryRunQueryOptions,
	refreshDryRunsChangeSetMutationOptions,
} from "@/lib/changeSetReactQuery"
import { queryClient } from "@/lib/query"

export function StagedChangesBar({
	projectSlug,
	changeSet,
}: {
	projectSlug: string
	changeSet: ChangeSet
}) {
	const [open, setOpen] = useState(false)
	const itemCount = changeSet.items.length

	const validateMutation = useMutation({
		...refreshDryRunsChangeSetMutationOptions({
			projectSlug,
			id: changeSet.id,
			queryClient,
		}),
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Validation failed"),
	})

	const applyMutation = useMutation({
		...applyChangeSetMutationOptions({
			projectSlug,
			id: changeSet.id,
			queryClient,
		}),
		onSuccess: () => {
			toast.success("Deploy started")
			setOpen(false)
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Deploy failed"),
	})

	const discardMutation = useMutation({
		...discardChangeSetMutationOptions({
			projectSlug,
			id: changeSet.id,
			queryClient,
		}),
		onSuccess: () => {
			toast.success("Changes discarded")
			setOpen(false)
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Discard failed"),
	})

	const removeMutation = useMutation({
		...deleteChangeSetItemMutationOptions({
			projectSlug,
			id: changeSet.id,
			queryClient,
		}),
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Remove failed"),
	})

	const validationPending = validateMutation.isPending

	const pending =
		validationPending || applyMutation.isPending || discardMutation.isPending

	return (
		<>
			<div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-background px-3 py-2 shadow-lg">
				<div className="flex items-center gap-2">
					<span className="flex size-6 items-center justify-center rounded-full border border-border bg-[color-mix(in_srgb,_var(--canvas-dots)_20%,_transparent)] text-xs font-medium tabular-nums text-white">
						{itemCount}
					</span>
					<span className="text-sm font-medium">staged changes</span>
				</div>
				<Button
					size="xs"
					variant="outline"
					className="h-7 px-3"
					onClick={() => setOpen(true)}
				>
					Review
				</Button>
				<Button
					size="xs"
					className="h-7 px-3"
					onClick={() => applyMutation.mutate()}
					disabled={pending}
				>
					{applyMutation.isPending && (
						<Loader2 className="size-3.5 animate-spin" />
					)}
					Deploy
				</Button>
			</div>

			<Sheet open={open} onOpenChange={setOpen}>
				<SheetContent
					side="bottom"
					showCloseButton={false}
					className="inset-x-4 bottom-4 max-h-[80svh] gap-0 overflow-hidden rounded-lg border p-0"
				>
					<SheetHeader className="border-b px-4 py-3">
						<div className="flex min-w-0 items-center justify-between gap-4">
							<SheetTitle className="text-sm font-medium leading-none">
								Staged changes
							</SheetTitle>
							<div className="flex shrink-0 items-center gap-2">
								<span className="text-xs text-muted-foreground">
									{itemCount} total
								</span>
								{validationPending && (
									<Badge variant="secondary">
										<Loader2 className="size-3 animate-spin" />
										validating
									</Badge>
								)}
								<SheetClose asChild>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="size-7 text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent"
									>
										<span className="sr-only">Close</span>
										<X className="size-4" />
									</Button>
								</SheetClose>
							</div>
						</div>
					</SheetHeader>
					<div className="grid max-h-[56svh] gap-3 overflow-y-auto p-4">
						<Accordion type="multiple" className="grid gap-2">
							{changeSet.items.map((item) => (
								<StagedChangeRow
									key={item.id}
									projectSlug={projectSlug}
									changeSetId={changeSet.id}
									item={item}
									onRemove={() => removeMutation.mutate(item.id)}
									removeDisabled={removeMutation.isPending}
								/>
							))}
						</Accordion>
					</div>
					<SheetFooter className="flex-row items-center justify-between px-4 pt-0 pb-2.5">
						<Button
							variant="outline"
							size="xs"
							className="h-7 px-3"
							onClick={() => discardMutation.mutate()}
							disabled={pending}
						>
							Discard all
						</Button>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="xs"
								className="h-7 px-3"
								onClick={() => validateMutation.mutate()}
								disabled={pending}
							>
								{validationPending ? (
									<Loader2 className="size-3.5 animate-spin" />
								) : (
									<RefreshCw className="size-3.5" />
								)}
								Refresh
							</Button>
							<Button
								size="xs"
								className="h-7 px-3"
								onClick={() => applyMutation.mutate()}
								disabled={pending}
							>
								{applyMutation.isPending && (
									<Loader2 className="size-3.5 animate-spin" />
								)}
								Deploy
							</Button>
						</div>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</>
	)
}

function StagedChangeRow({
	projectSlug,
	changeSetId,
	item,
	onRemove,
	removeDisabled,
}: {
	projectSlug: string
	changeSetId: string
	item: ChangeSetItem
	onRemove: () => void
	removeDisabled: boolean
}) {
	const { data: dryRun = null } = useQuery(
		dryRunQueryOptions({
			projectSlug,
			changeSetId,
			itemId: item.id,
			initialData: item.dryRun,
		}),
	)
	return (
		<AccordionItem value={item.id} className="border-b-0">
			<div className="flex items-start gap-4">
				<div className="flex-1 overflow-hidden rounded-lg border bg-background">
					<AccordionTrigger className="items-center gap-2 px-3 py-3 hover:no-underline">
						<CompactChangeSummary
							item={item}
							hideDetail
							className="min-w-0 flex-1"
							statusSlot={<DryRunChip dryRun={dryRun} />}
						/>
					</AccordionTrigger>
					<AccordionContent className="border-t pb-3">
						<div className="grid gap-3 px-3 pt-3">
							<DryRunErrorNote dryRun={dryRun} />
							<ChangeDetail item={item} dryRun={dryRun} />
						</div>
					</AccordionContent>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="mt-2 size-7 shrink-0 text-muted-foreground hover:bg-transparent hover:text-[#e23a3a] dark:hover:bg-transparent"
					onClick={onRemove}
					disabled={removeDisabled}
					aria-label="Remove staged change"
					title="Remove staged change"
				>
					<Trash2 className="size-4" />
				</Button>
			</div>
		</AccordionItem>
	)
}
