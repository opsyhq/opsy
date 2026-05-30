import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function CreateProjectDialog({
	open,
	slug,
	pending,
	onOpenChange,
	onSlugChange,
	onSubmit,
}: {
	open: boolean
	slug: string
	pending: boolean
	onOpenChange: (open: boolean) => void
	onSlugChange: (slug: string) => void
	onSubmit: () => void
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form
					onSubmit={(e) => {
						e.preventDefault()
						onSubmit()
					}}
				>
					<DialogHeader>
						<DialogTitle>Create project</DialogTitle>
						<DialogDescription>
							Projects organize resources, integrations, and operations.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<Label htmlFor="slug">Slug</Label>
						<Input
							id="slug"
							placeholder="my-project"
							value={slug}
							onChange={(e) => onSlugChange(e.target.value)}
							required
							className="mt-2"
						/>
					</div>
					<DialogFooter>
						<Button type="submit" disabled={pending}>
							{pending ? "Creating..." : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
