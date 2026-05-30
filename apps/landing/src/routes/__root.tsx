import { TanStackDevtools } from "@tanstack/react-devtools"
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"

import PostHogProvider from "../integrations/posthog/provider"

import appCss from "../styles.css?url"

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{ title: "Opsy — Infrastructure management, next generation" },
			{
				name: "description",
				content:
					"Deploy, operate, and observe every cloud resource from a single control plane. Opsy is in beta — sign up free.",
			},
			{ name: "theme-color", content: "#08090a" },
			{ name: "color-scheme", content: "dark" },
			{
				property: "og:title",
				content: "Opsy — Infrastructure management, next generation",
			},
			{
				property: "og:description",
				content:
					"Deploy, operate, and observe every cloud resource from a single control plane. In beta — sign up free.",
			},
			{ property: "og:type", content: "website" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
			{
				rel: "icon",
				type: "image/x-icon",
				href: "/favicon.ico",
				sizes: "32x32",
			},
			{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
			{ rel: "manifest", href: "/manifest.json" },
		],
	}),
	shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<PostHogProvider>
					{children}
					<TanStackDevtools
						config={{
							position: "bottom-right",
						}}
						plugins={[
							{
								name: "Tanstack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
						]}
					/>
				</PostHogProvider>
				<Scripts />
			</body>
		</html>
	)
}
