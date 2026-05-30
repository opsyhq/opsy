import type { QueryClient } from "@tanstack/react-query"
import {
	createRootRouteWithContext,
	ErrorComponent,
	Outlet,
} from "@tanstack/react-router"
import type { authClient } from "@/lib/auth"

type RouterContext = {
	session: typeof authClient.$Infer.Session | null
	queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: () => <Outlet />,
	errorComponent: ({ error }) => (
		<div className="flex min-h-screen items-center justify-center">
			<ErrorComponent error={error} />
		</div>
	),
	notFoundComponent: () => (
		<div className="flex min-h-screen items-center justify-center">
			<p className="text-muted-foreground">Page not found</p>
		</div>
	),
})
