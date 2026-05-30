import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { projectQueryOptions } from "@/lib/projectReactQuery"
import { ProjectSettingsPage } from "./-ProjectSettingsPage"

export const Route = createFileRoute(
	"/_app/projects/$projectSlug/settings/",
)({
	loader: ({ context, params }) =>
		context.queryClient.ensureQueryData(
			projectQueryOptions({ slug: params.projectSlug }),
		),
	component: SettingsView,
})

function SettingsView() {
	const { projectSlug } = Route.useParams()
	const { data } = useSuspenseQuery(projectQueryOptions({ slug: projectSlug }))
	const project = data.project

	return (
		<div className="flex min-w-0 flex-1 flex-col px-2">
			<div className="h-full w-full overflow-y-auto rounded-[10px] border bg-background">
				<div className="mx-auto w-full min-w-0 max-w-2xl px-8 py-10">
					<ProjectSettingsPage
						key={`${project.approvalPolicy.join(",")}:${project.scanInterval}`}
						slug={projectSlug}
						currentPolicy={project.approvalPolicy}
						currentScanInterval={project.scanInterval}
					/>
				</div>
			</div>
		</div>
	)
}
