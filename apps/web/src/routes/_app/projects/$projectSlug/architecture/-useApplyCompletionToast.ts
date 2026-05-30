import { useSuspenseQuery } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { activeChangeSetQueryOptions } from "@/lib/changeSetReactQuery"

// Per-op failure toasts arrive via SSE; this hook only fires the per-changeset
// completion toast, so it treats success / rollback-to-draft / cancel the same.
export function useApplyCompletionToast(projectSlug: string): void {
	const { data } = useSuspenseQuery(
		activeChangeSetQueryOptions({ projectSlug }),
	)
	const seen = useRef<Map<string, string | null>>(new Map())

	const applyingKey = data.applying.map((cs) => cs.id).join(",")
	useEffect(() => {
		const next = new Map<string, string | null>(
			data.applying.map((cs) => [cs.id, cs.title ?? null]),
		)
		for (const [id, title] of seen.current) {
			if (!next.has(id)) {
				toast.success(title ? `Deploy finished: ${title}` : "Deploy finished")
			}
		}
		seen.current = next
		// data.applying intentionally omitted — applyingKey captures the relevant change.
	}, [applyingKey, toast])
}
