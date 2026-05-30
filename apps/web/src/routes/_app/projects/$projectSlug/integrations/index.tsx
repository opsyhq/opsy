import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { TableSkeleton } from "@/components/TableSkeleton"
import { projectIntegrationsQueryOptions } from "@/lib/projectReactQuery"
import { ProjectIntegrationsPage } from "./-ProjectIntegrationsPage"

export const Route = createFileRoute(
	"/_app/projects/$projectSlug/integrations/",
)({
	loader: ({ context, params }) =>
		context.queryClient.ensureQueryData(
			projectIntegrationsQueryOptions({ slug: params.projectSlug }),
		),
	component: IntegrationsView,
	pendingComponent: () => <TableSkeleton />,
})

function IntegrationsView() {
	const { projectSlug } = Route.useParams()
	const { data } = useSuspenseQuery(
		projectIntegrationsQueryOptions({ slug: projectSlug }),
	)

	return (
		<div className="flex min-w-0 flex-1 flex-col px-2">
			<div className="h-full w-full overflow-y-auto rounded-[10px] border bg-background p-10">
				<ProjectIntegrationsPage
					slug={projectSlug}
					integrations={data.integrations}
				/>
			</div>
		</div>
	)
}
