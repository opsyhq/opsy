import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { FolderOpen, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { EmptyState } from "@/components/EmptyState"
import { TableSkeleton } from "@/components/TableSkeleton"
import { Button } from "@/components/ui/button"
import { Card, CardHeader } from "@/components/ui/card"
import {
	createProjectMutationOptions,
	deleteProjectMutationOptions,
	projectsQueryOptions,
} from "@/lib/projectReactQuery"
import { queryClient } from "@/lib/query"
import { relativeTime } from "@/lib/utils"
import { CreateProjectDialog } from "./-CreateProjectDialog"
import { DeleteProjectDialog } from "./-DeleteProjectDialog"
import { projectColor } from "./-projectColor"

export const Route = createFileRoute("/_app/projects/")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(projectsQueryOptions()),
	component: ProjectsPage,
	pendingComponent: () => <TableSkeleton />,
})

function ProjectsPage() {
	const [createOpen, setCreateOpen] = useState(false)
	const [createSlug, setCreateSlug] = useState("")
	const [deleteSlug, setDeleteSlug] = useState<string | null>(null)

	const { data } = useSuspenseQuery(projectsQueryOptions())
	const projects = [...data.projects].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	)

	const createProject = useMutation({
		...createProjectMutationOptions({ queryClient }),
		onSuccess: () => {
			setCreateOpen(false)
			setCreateSlug("")
			toast.success("Project created")
		},
	})

	const deleteProject = useMutation({
		...deleteProjectMutationOptions({ queryClient }),
		onSuccess: () => {
			setDeleteSlug(null)
			toast.success("Project deleted")
		},
	})

	function openCreate() {
		setCreateSlug("")
		setCreateOpen(true)
	}

	return (
		<div className="flex min-w-0 flex-1 flex-col px-2">
			<div className="flex h-full w-full flex-col overflow-hidden rounded-[10px] border bg-background">
				<div className="flex flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-10">
					<div>
						<div className="flex items-center justify-between gap-3">
							<h1 className="text-2xl font-medium tracking-tight">Projects</h1>
							<Button
								size="xs"
								className="h-7 px-4 text-[11px] has-[>svg]:px-4"
								onClick={openCreate}
							>
								<Plus />
								New Project
							</Button>
						</div>
						<p className="mt-1 text-sm font-light text-muted-foreground">
							Manage your infrastructure projects.
						</p>
					</div>

					{projects.length === 0 && (
						<div className="flex flex-1 items-center justify-center pb-32">
							<EmptyState icon={FolderOpen} title="No projects yet" />
						</div>
					)}

				{projects.length > 0 && (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{projects.map((p) => (
							<Card
								key={p.id}
								className="group relative cursor-pointer gap-3 overflow-hidden rounded-lg border bg-background transition-colors hover:bg-muted/30"
							>
								<Link
									to="/projects/$projectSlug/architecture"
									params={{ projectSlug: p.slug }}
									aria-label={p.slug}
									className="absolute inset-0 z-0"
								/>
								<CardHeader className="flex flex-row items-start gap-3 space-y-0">
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2 truncate font-mono text-sm font-medium">
											<span
												aria-hidden
												className="size-3.5 shrink-0 rounded-full"
												style={{ backgroundColor: projectColor(p.slug) }}
											/>
											<span className="truncate">{p.slug}</span>
										</div>
										<p className="mt-0.5 pl-[22px] text-xs font-light text-muted-foreground">
											{relativeTime(p.createdAt)}
										</p>
									</div>
									<span className="shrink-0 text-xs font-light text-muted-foreground/70">
										{p.approvalPolicy.length === 0
											? "no approval"
											: p.approvalPolicy.join(", ")}
									</span>
								</CardHeader>
								<div className="relative z-10 flex justify-end px-6">
									<button
										type="button"
										aria-label="Delete project"
										onClick={(e) => {
											e.preventDefault()
											e.stopPropagation()
											setDeleteSlug(p.slug)
										}}
										className="cursor-pointer text-muted-foreground/70 transition-colors hover:text-muted-foreground"
									>
										<Trash2 className="size-4" />
									</button>
								</div>
							</Card>
						))}
					</div>
				)}

				<CreateProjectDialog
					open={createOpen}
					slug={createSlug}
					pending={createProject.isPending}
					onOpenChange={(open) => {
						setCreateOpen(open)
						if (!open) setCreateSlug("")
					}}
					onSlugChange={setCreateSlug}
					onSubmit={() => createProject.mutate(createSlug)}
				/>

				<DeleteProjectDialog
					slug={deleteSlug}
					pending={deleteProject.isPending}
					onClose={() => setDeleteSlug(null)}
					onConfirm={() => deleteSlug && deleteProject.mutate(deleteSlug)}
				/>
				</div>
			</div>
		</div>
	)
}
