import { PostHogProvider as BasePostHogProvider } from "@posthog/react"
import posthog from "posthog-js"
import type { ReactNode } from "react"

if (typeof window !== "undefined" && import.meta.env.VITE_POSTHOG_KEY) {
	posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
		api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
		person_profiles: "identified_only",
		// $pageview = "loaded the site"; $pageleave lets PostHog Web Analytics
		// derive session duration / bounce ("how long they stayed").
		capture_pageview: true,
		capture_pageleave: true,
		// Cookieless: nothing is written to cookies or localStorage, so no
		// consent banner is required. Trade-off: distinct_id lives only in
		// memory, so a returning visitor counts as new — acceptable for a
		// single-page landing where pageviews / time-on-page / CTA events
		// are what matter.
		persistence: "memory",
		disable_session_recording: true,
		defaults: "2026-01-30",
	})
}

interface PostHogProviderProps {
	children: ReactNode
}

export default function PostHogProvider({ children }: PostHogProviderProps) {
	return <BasePostHogProvider client={posthog}>{children}</BasePostHogProvider>
}
