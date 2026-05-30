import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"

export function DeleteProjectDialog({
	slug,
	pending,
	onClose,
	onConfirm,
}: {
	slug: string | null
	pending: boolean
	onClose: () => void
	onConfirm: () => void
}) {
	return (
		<Dialog open={slug !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete project</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete{" "}
						<span className="font-mono font-semibold">{slug}</span>? This action
						cannot be undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="destructive" onClick={onConfirm} disabled={pending}>
						{pending ? "Deleting..." : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
