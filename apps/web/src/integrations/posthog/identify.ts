import posthog from "posthog-js"
import { useEffect, useRef } from "react"

interface IdentifiableUser {
	id: string
	email?: string | null
	name?: string | null
}

export function usePosthogIdentify(user: IdentifiableUser | null | undefined) {
	const lastIdRef = useRef<string | null>(null)

	useEffect(() => {
		if (!import.meta.env.VITE_POSTHOG_KEY) return

		if (user?.id) {
			if (lastIdRef.current === user.id) return
			lastIdRef.current = user.id
			posthog.identify(user.id, {
				email: user.email ?? undefined,
				name: user.name ?? undefined,
			})
			return
		}

		if (lastIdRef.current !== null) {
			lastIdRef.current = null
			posthog.reset()
		}
	}, [user?.id, user?.email, user?.name])
}
