import { createFileRoute } from "@tanstack/react-router"
import { ResourceDetail } from "@/components/ResourceDetail"
import { TableSkeleton } from "@/components/TableSkeleton"
import { projectOperationsQueryOptions } from "@/lib/projectReactQuery"
import { resourceQueryOptions } from "@/lib/resourceReactQuery"

type ResourceTab = "configuration" | "operations"

const VALID_TABS: ResourceTab[] = ["configuration", "operations"]

function coerceTab(v: unknown): ResourceTab | undefined {
	return typeof v === "string" && (VALID_TABS as string[]).includes(v)
		? (v as ResourceTab)
		: undefined
}

export const Route = createFileRoute(
	"/_app/projects/$projectSlug/resources/$resourceSlug/",
)({
	validateSearch: (search: Record<string, unknown>): { tab?: ResourceTab } => ({
		tab: coerceTab(search.tab),
	}),
	loader: ({ context, params }) => {
		const { projectSlug, resourceSlug } = params
		return Promise.all([
			context.queryClient.ensureQueryData(
				resourceQueryOptions({ projectSlug, resourceSlug }),
			),
			context.queryClient.ensureQueryData(
				projectOperationsQueryOptions({
					slug: projectSlug,
					resourceSlug,
					limit: 20,
				}),
			),
		])
	},
	component: ResourceDetailPage,
	pendingComponent: () => <TableSkeleton />,
})

function ResourceDetailPage() {
	const { projectSlug, resourceSlug } = Route.useParams()
	return (
		<div className="w-full p-6">
			<ResourceDetail
				key={resourceSlug}
				projectSlug={projectSlug}
				resourceSlug={resourceSlug}
				variant="page"
			/>
		</div>
	)
}
