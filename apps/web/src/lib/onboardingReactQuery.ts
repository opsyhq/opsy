import {
	mutationOptions,
	type QueryClient,
	queryOptions,
} from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"
import { api } from "@/lib/api"

export type OnboardingStatus = InferResponseType<
	typeof api.onboarding.status.$get,
	200
>

export const onboardingQueryKeys = {
	status: () => ["onboarding", "status"],
}

const onboardingMutationKeys = {
	complete: () => ["onboarding", "mutation", "complete"],
}

export function onboardingStatusQueryOptions() {
	return queryOptions({
		queryKey: onboardingQueryKeys.status(),
		queryFn: async () => {
			const res = await api.onboarding.status.$get()
			if (!res.ok) throw new Error("Failed to fetch onboarding status")
			return res.json()
		},
	})
}

export function completeOnboardingMutationOptions(input: {
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: onboardingMutationKeys.complete(),
		mutationFn: async () => {
			const res = await api.onboarding.complete.$post()
			if (!res.ok) throw new Error("Failed to mark onboarding complete")
			return res.json()
		},
		onSuccess: () =>
			input.queryClient.invalidateQueries({
				queryKey: onboardingQueryKeys.status(),
			}),
	})
}
