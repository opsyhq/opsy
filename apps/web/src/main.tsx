import { QueryClientProvider } from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { ThemeProvider } from "next-themes"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { usePosthogIdentify } from "@/integrations/posthog/identify"
import PostHogProvider from "@/integrations/posthog/provider"
import { authClient } from "@/lib/auth"
import { queryClient } from "@/lib/query"
import { routeTree } from "./routeTree.gen"
import "@xyflow/react/dist/style.css"
import "./styles.css"

const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	context: {
		// biome-ignore lint/style/noNonNullAssertion: provided at render time via RouterProvider context prop
		session: undefined!,
		queryClient,
	},
})

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router
	}
}

function InnerApp() {
	const { data: session, isPending } = authClient.useSession()
	usePosthogIdentify(session?.user)

	if (isPending) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		)
	}

	return (
		<RouterProvider
			router={router}
			context={{ session: session ?? null, queryClient }}
		/>
	)
}

// biome-ignore lint/style/noNonNullAssertion: root element always exists in index.html
createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
			<PostHogProvider>
				<QueryClientProvider client={queryClient}>
					<TooltipProvider>
						<InnerApp />
						<Toaster />
					</TooltipProvider>
				</QueryClientProvider>
			</PostHogProvider>
		</ThemeProvider>
	</StrictMode>,
)
