import { useMatchRoute } from "@tanstack/react-router"

export function useActiveProjectSlug(): string | undefined {
	const matchRoute = useMatchRoute()
	const match = matchRoute({ to: "/projects/$projectSlug", fuzzy: true })
	if (match && typeof match === "object" && "projectSlug" in match) {
		return match.projectSlug as string
	}
	return undefined
}
