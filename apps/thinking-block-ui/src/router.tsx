import {
	createRootRoute,
	createRoute,
	createRouter,
	ErrorComponent,
	Link,
	Outlet,
} from "@tanstack/react-router"
import { ArtifactDetailPage } from "@/pages/ArtifactDetailPage"
import { BlockResourcesPage } from "@/pages/BlockResourcesPage"
import { BlocksPage } from "@/pages/BlocksPage"
import { LoginPage } from "@/pages/LoginPage"
import { ResourceArtifactsPage } from "@/pages/ResourceArtifactsPage"

function Shell() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
				<div className="flex h-12 items-center justify-between px-4">
					<Link
						to="/"
						className="text-sm font-semibold tracking-normal text-foreground"
					>
						Thinking Blocks
					</Link>
					<nav className="flex items-center gap-3 text-xs text-muted-foreground">
						<Link
							to="/"
							activeProps={{ className: "text-foreground" }}
							className="hover:text-foreground"
						>
							Blocks
						</Link>
					</nav>
				</div>
			</header>
			<main className="mx-auto w-full max-w-[1480px] px-4 py-4">
				<Outlet />
			</main>
		</div>
	)
}

const rootRoute = createRootRoute({
	component: Shell,
	errorComponent: ({ error }) => (
		<div className="flex min-h-[60vh] items-center justify-center">
			<ErrorComponent error={error} />
		</div>
	),
	notFoundComponent: () => (
		<div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
			Not found
		</div>
	),
})

type LoginSearch = {
	redirect?: string
}

const loginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/login",
	validateSearch: (search: Record<string, unknown>): LoginSearch => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
	component: LoginPage,
})

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: BlocksPage,
})

const blockRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/blocks/$blockName",
	component: BlockResourcesPage,
})

const resourceRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/resources/$identityRef",
	component: ResourceArtifactsPage,
})

const artifactRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/artifacts/$artifactId",
	component: ArtifactDetailPage,
})

const routeTree = rootRoute.addChildren([
	loginRoute,
	indexRoute,
	blockRoute,
	resourceRoute,
	artifactRoute,
])

export const router = createRouter({
	routeTree,
	defaultPreload: "intent",
})

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router
	}
}
