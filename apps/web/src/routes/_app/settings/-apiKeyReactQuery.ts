import { mutationOptions, queryOptions } from "@tanstack/react-query"
import { authClient } from "@/lib/auth"
import { queryClient } from "@/lib/query"

type ApiKeyRow = {
	id: string
	name?: string | null
	prefix?: string | null
	start?: string | null
	createdAt?: Date | string
	lastRequest?: Date | string | null
}

const apiKeyQueryKeys = {
	all: ["api-keys"] as const,
	list: () => ["api-keys", "list"] as const,
}

const apiKeyMutationKeys = {
	create: () => ["api-keys", "mutation", "create"] as const,
	deleteAny: () => ["api-keys", "mutation", "delete"] as const,
}

function invalidateApiKeyQueries() {
	return queryClient.invalidateQueries({ queryKey: apiKeyQueryKeys.list() })
}

export function apiKeysQueryOptions() {
	return queryOptions({
		queryKey: apiKeyQueryKeys.list(),
		queryFn: async (): Promise<ApiKeyRow[]> => {
			const { data, error } = await authClient.apiKey.list()
			if (error) throw new Error(error.message ?? "Failed to load keys")
			return (
				(data as unknown as { apiKeys?: ApiKeyRow[] } | null)?.apiKeys ?? []
			)
		},
	})
}

export function createApiKeyMutationOptions(input: {
	organizationId: string | undefined
}) {
	return mutationOptions({
		mutationKey: apiKeyMutationKeys.create(),
		mutationFn: async (name: string) => {
			if (!input.organizationId) throw new Error("No active organization")
			const { data, error } = await authClient.apiKey.create({
				name,
				organizationId: input.organizationId,
				prefix: "opsy_",
			})
			if (error) throw new Error(error.message ?? "Failed to create key")
			return data as { key?: string } | null
		},
		onSettled: () => invalidateApiKeyQueries(),
	})
}

export function deleteApiKeyMutationOptions() {
	return mutationOptions({
		mutationKey: apiKeyMutationKeys.deleteAny(),
		mutationFn: async (id: string) => {
			const { error } = await authClient.apiKey.delete({ keyId: id })
			if (error) throw new Error(error.message ?? "Failed to delete key")
		},
		onSettled: () => invalidateApiKeyQueries(),
	})
}
