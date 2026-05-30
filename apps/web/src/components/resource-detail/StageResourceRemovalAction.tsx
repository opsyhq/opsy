import { useMutation } from "@tanstack/react-query"
import { Loader2, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { stageChangeSetItemMutationOptions } from "@/lib/changeSetReactQuery"
import { queryClient } from "@/lib/query"

export function StageResourceRemovalAction({
	projectSlug,
	resourceSlug,
}: {
	projectSlug: string
	resourceSlug: string
}) {
	const [open, setOpen] = useState(false)
	const stageMutation = useMutation({
		...stageChangeSetItemMutationOptions({
			projectSlug,
			queryClient,
		}),
		onSuccess: () => {
			toast.success("Resource removal staged")
			setOpen(false)
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Delete failed"),
	})
	const pending = stageMutation.isPending

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<Button
				size="icon-xs"
				variant="destructive"
				className="size-7 rounded-md bg-[#e23a3a] text-white hover:bg-red-500 dark:bg-[#e23a3a] dark:hover:bg-red-500"
				onClick={() => setOpen(true)}
				aria-label="Delete"
				title="Delete"
			>
				<Trash2 className="size-3.5" />
			</Button>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Remove or destroy {resourceSlug}</DialogTitle>
					<DialogDescription>
						<span className="block">
							<strong className="font-medium text-foreground">
								Remove tracking
							</strong>{" "}
							removes this resource from Opsy without touching the cloud object.
						</span>
						<span className="mt-1 block">
							<strong className="font-medium text-foreground">
								Destroy cloud resource
							</strong>{" "}
							deletes the cloud object through the provider, then removes it
							from Opsy.
						</span>
					</DialogDescription>
				</DialogHeader>

				<DialogFooter className="sm:justify-between">
					<Button
						variant="ghost"
						onClick={() => setOpen(false)}
						disabled={pending}
					>
						Cancel
					</Button>
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={() =>
								stageMutation.mutate({
									kind: "delete_resource",
									targetResourceSlug: resourceSlug,
									changes: { mode: "forget" },
								})
							}
							disabled={pending}
						>
							{pending && <Loader2 className="size-3.5 animate-spin" />}
							Remove tracking
						</Button>
						<Button
							variant="destructive"
							onClick={() =>
								stageMutation.mutate({
									kind: "delete_resource",
									targetResourceSlug: resourceSlug,
									changes: { mode: "delete" },
								})
							}
							disabled={pending}
						>
							{pending && <Loader2 className="size-3.5 animate-spin" />}
							Destroy cloud resource
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
