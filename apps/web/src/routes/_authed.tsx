import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed")({
	beforeLoad: ({ context, location }) => {
		if (!context.session?.user) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			})
		}
	},
	component: () => <Outlet />,
})
