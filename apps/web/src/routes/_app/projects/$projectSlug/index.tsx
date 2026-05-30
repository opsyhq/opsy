import { createFileRoute, redirect } from "@tanstack/react-router"
import {
	coerceOperationLimit,
	coerceString,
	type OperationLimit,
} from "./-routeSearch"

type ProjectTab = "resources" | "operations" | "integrations" | "settings"

type LegacySearch = {
	tab?: ProjectTab
	operationResource?: string
	operationKind?: string
	operationStatus?: string
	operationLimit?: OperationLimit
	importIntegrationSlug?: string
}

const VALID_TABS: ProjectTab[] = [
	"resources",
	"operations",
	"integrations",
	"settings",
]

function coerceTab(v: unknown): ProjectTab | undefined {
	return typeof v === "string" && (VALID_TABS as string[]).includes(v)
		? (v as ProjectTab)
		: undefined
}

export const Route = createFileRoute("/_app/projects/$projectSlug/")({
	validateSearch: (search: Record<string, unknown>): LegacySearch => ({
		tab: coerceTab(search.tab),
		operationResource: coerceString(search.operationResource),
		operationKind: coerceString(search.operationKind),
		operationStatus: coerceString(search.operationStatus),
		operationLimit: coerceOperationLimit(search.operationLimit),
		importIntegrationSlug: coerceString(search.importIntegrationSlug),
	}),
	beforeLoad: ({ search, params }) => {
		const tab = search.tab
		if (tab === "integrations") {
			throw redirect({
				to: "/projects/$projectSlug/integrations",
				params,
			})
		}
		if (tab === "settings") {
			throw redirect({
				to: "/projects/$projectSlug/settings",
				params,
			})
		}
		throw redirect({
			to: "/projects/$projectSlug/architecture",
			params,
			search: {
				operationResource: search.operationResource,
				operationKind: search.operationKind,
				operationStatus: search.operationStatus,
				operationLimit: search.operationLimit,
				importIntegrationSlug: search.importIntegrationSlug,
			},
		})
	},
	component: () => null,
})
