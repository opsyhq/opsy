import { useEffect, useRef } from "react"

export function useInfiniteSentinel(enabled: boolean, onVisible: () => void) {
	const ref = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		const node = ref.current
		if (!node || !enabled) return
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) onVisible()
			},
			{ rootMargin: "320px" },
		)
		observer.observe(node)
		return () => observer.disconnect()
	}, [enabled, onVisible])

	return ref
}
