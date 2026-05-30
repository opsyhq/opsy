import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import {
	completeOnboardingMutationOptions,
	type OnboardingStatus,
	onboardingStatusQueryOptions,
} from "@/lib/onboardingReactQuery"

export type UseOnboardingResult = {
	/** True until the first status fetch resolves. */
	isLoading: boolean
	/** True once the org's checklist has been marked complete (persisted). */
	completed: boolean
	/** Per-task derived state. All true when `completed` is true. */
	tasks: OnboardingStatus["tasks"]
	/** True when every task is done but `completed` has not yet been persisted. */
	allTasksDone: boolean
}

// Drives the onboarding checklist UI. Read pattern:
//
//   const { completed, tasks } = useOnboarding()
//   if (completed) return null
//   return <Checklist tasks={tasks} />
//
// The hook auto-persists completion the first time it observes all tasks done
// — the consumer doesn't need to call anything. Once persisted, future renders
// short-circuit on `completed: true` and never re-fetch task state.
export function useOnboarding(): UseOnboardingResult {
	const queryClient = useQueryClient()
	const { data, isLoading } = useQuery(onboardingStatusQueryOptions())
	const complete = useMutation(
		completeOnboardingMutationOptions({ queryClient }),
	)

	const completed = data?.completed ?? false
	const tasks: OnboardingStatus["tasks"] = data?.tasks ?? {
		organization: false,
		project: false,
		integration: false,
		resource: false,
	}
	const allTasksDone =
		tasks.organization && tasks.project && tasks.integration && tasks.resource

	// Auto-persist the transition. Gated on `!completed` (server hasn't stamped
	// yet), `allTasksDone` (every task derived true this render), and the
	// mutation's own idle state (don't double-fire while the POST is in flight).
	// The mutation invalidates the status query on success, which flips
	// `completed` to true and unmounts the checklist on the next render.
	useEffect(() => {
		if (!completed && allTasksDone && complete.isIdle) {
			complete.mutate()
		}
	}, [completed, allTasksDone, complete])

	return { isLoading, completed, tasks, allTasksDone }
}
