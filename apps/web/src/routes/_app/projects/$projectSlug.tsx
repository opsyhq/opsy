import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Outlet } from "@tanstack/react-router"
import { TableSkeleton } from "@/components/TableSkeleton"
import {
	projectQueryOptions,
	projectsQueryOptions,
} from "@/lib/projectReactQuery"
import { useProjectEventStream } from "./-useProjectEventStream"

export const Route = createFileRoute("/_app/projects/$projectSlug")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.ensureQueryData(
				projectQueryOptions({ slug: params.projectSlug }),
			),
			context.queryClient.ensureQueryData(projectsQueryOptions()),
		]),
	component: ProjectLayout,
	pendingComponent: () => <TableSkeleton />,
})

function ProjectLayout() {
	const { projectSlug } = Route.useParams()
	const { data } = useSuspenseQuery(projectQueryOptions({ slug: projectSlug }))
	useProjectEventStream(data.project.id, projectSlug)

	return (
		<div className="flex min-w-0 flex-1">
			<Outlet />
		</div>
	)
}
