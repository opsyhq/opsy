import {
	mutationOptions,
	type QueryClient,
	queryOptions,
} from "@tanstack/react-query"
import { api } from "@/lib/api"
import { invalidateProjectIntegrationsQueries } from "@/lib/projectReactQuery"

const integrationQueryKeys = {
	all: ["integrations"] as const,
	bySlug: (projectSlug: string, slug: string) =>
		["integrations", "by-slug", projectSlug, slug] as const,
	providers: () => ["integrations", "schema", "providers"] as const,
	integrationSchema: (
		provider: string,
		providerSource: string,
		providerVersion: string,
	) =>
		[
			"integrations",
			"schema",
			"providers",
			provider,
			providerSource,
			providerVersion,
			"integration",
		] as const,
	providerOnboarding: (
		provider: string,
		providerSource: string,
		providerVersion: string,
		onboardingKind: string,
		externalId: string,
	) =>
		[
			"integrations",
			"schema",
			"providers",
			provider,
			providerSource,
			providerVersion,
			onboardingKind,
			externalId,
		] as const,
}

export function integrationBySlugQueryOptions(input: {
	projectSlug: string
	slug: string
}) {
	return queryOptions({
		queryKey: integrationQueryKeys.bySlug(input.projectSlug, input.slug),
		queryFn: async () => {
			const res = await api.projects[":project"].integrations[":slug"].$get({
				param: { project: input.projectSlug, slug: input.slug },
			})
			if (!res.ok) throw new Error("Failed to load integration")
			return res.json()
		},
	})
}

export function providersQueryOptions() {
	return queryOptions({
		queryKey: integrationQueryKeys.providers(),
		queryFn: async () => {
			const res = await api.providers.$get()
			if (!res.ok) throw new Error("Failed to fetch providers")
			return res.json()
		},
	})
}

export function integrationSchemaQueryOptions(input: {
	provider: string
	providerSource?: string
	providerVersion?: string
}) {
	return queryOptions({
		queryKey: integrationQueryKeys.integrationSchema(
			input.provider,
			input.providerSource ?? "",
			input.providerVersion ?? "",
		),
		enabled: input.provider.length > 0,
		queryFn: async () => {
			const res = await api.providers[":provider"]["integration-schema"].$get({
				param: { provider: input.provider },
				query: {
					...(input.providerSource
						? { providerSource: input.providerSource }
						: {}),
					...(input.providerVersion
						? { providerVersion: input.providerVersion }
						: {}),
				},
			})
			if (!res.ok) throw new Error("Failed to fetch integration schema")
			return res.json()
		},
	})
}

export function providerOnboardingQueryOptions(input: {
	provider: string
	providerSource?: string
	providerVersion?: string
	onboardingKind: string
	externalId: string
}) {
	return queryOptions({
		queryKey: integrationQueryKeys.providerOnboarding(
			input.provider,
			input.providerSource ?? "",
			input.providerVersion ?? "",
			input.onboardingKind,
			input.externalId,
		),
		enabled:
			input.provider.length > 0 &&
			input.onboardingKind.length > 0 &&
			input.externalId.length > 0,
		queryFn: async () => {
			const res = await api.providers[":provider"].onboarding[
				":onboardingKind"
			].$get({
				param: {
					provider: input.provider,
					onboardingKind: input.onboardingKind,
				},
				query: {
					external_id: input.externalId,
					...(input.providerSource
						? { providerSource: input.providerSource }
						: {}),
					...(input.providerVersion
						? { providerVersion: input.providerVersion }
						: {}),
				},
			})
			if (!res.ok) throw new Error("Failed to fetch onboarding data")
			return res.json()
		},
	})
}

const integrationMutationKeys = {
	checkDraft: (projectSlug: string) =>
		["integrations", "mutation", "check-draft", projectSlug] as const,
	check: (projectSlug: string, id: string) =>
		["integrations", "mutation", "check", projectSlug, id] as const,
	create: (projectSlug: string) =>
		["integrations", "mutation", "create", projectSlug] as const,
	update: (projectSlug: string, id: string) =>
		["integrations", "mutation", "update", projectSlug, id] as const,
	delete: (projectSlug: string) =>
		["integrations", "mutation", "delete", projectSlug] as const,
}

export function checkDraftProjectIntegrationMutationOptions(input: {
	projectSlug: string
}) {
	return mutationOptions({
		mutationKey: integrationMutationKeys.checkDraft(input.projectSlug),
		mutationFn: async (body: {
			provider: string
			providerSource?: string
			providerVersion?: string
			credentials?: Record<string, unknown>
			config: Record<string, unknown>
		}) => {
			const res = await api.projects[":project"].integrations.check.$post({
				param: { project: input.projectSlug },
				json: body,
			})
			if (!res.ok) {
				const data = (await res.json().catch(() => null)) as {
					message?: string
				} | null
				throw new Error(data?.message ?? "Failed to check integration")
			}
			return res.json()
		},
	})
}

export function checkProjectIntegrationMutationOptions(input: {
	projectSlug: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: integrationMutationKeys.check(input.projectSlug, "*"),
		mutationFn: async (body: {
			slug: string
			credentials?: Record<string, unknown>
			config?: Record<string, unknown>
		}) => {
			const res = await api.projects[":project"].integrations[
				":slug"
			].check.$post({
				param: { project: input.projectSlug, slug: body.slug },
				json: {
					...(body.credentials ? { credentials: body.credentials } : {}),
					...(body.config ? { config: body.config } : {}),
				},
			})
			if (!res.ok) {
				const data = (await res.json().catch(() => null)) as {
					message?: string
				} | null
				throw new Error(data?.message ?? "Failed to check integration")
			}
			return res.json()
		},
		onSettled: (_data, _error, body) =>
			Promise.all([
				input.queryClient.invalidateQueries({
					queryKey: integrationQueryKeys.bySlug(
						input.projectSlug,
						body?.slug ?? "",
					),
				}),
				invalidateProjectIntegrationsQueries(
					input.queryClient,
					input.projectSlug,
				),
			]),
	})
}

export function createProjectIntegrationMutationOptions(input: {
	projectSlug: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: integrationMutationKeys.create(input.projectSlug),
		mutationFn: async (body: {
			provider: string
			providerSource?: string
			providerVersion?: string
			slug: string
			name?: string
			default?: boolean
			credentials: Record<string, unknown>
			config: Record<string, unknown>
		}) => {
			const res = await api.projects[":project"].integrations.$post({
				param: { project: input.projectSlug },
				json: body,
			})
			if (!res.ok) {
				const data = (await res.json().catch(() => null)) as {
					message?: string
				} | null
				throw new Error(data?.message ?? "Failed to create integration")
			}
			return res.json()
		},
		onSettled: () =>
			invalidateProjectIntegrationsQueries(
				input.queryClient,
				input.projectSlug,
			),
	})
}

export function updateProjectIntegrationMutationOptions(input: {
	projectSlug: string
	slug: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: integrationMutationKeys.update(input.projectSlug, input.slug),
		mutationFn: async (body: {
			name?: string
			default?: boolean
			credentials?: Record<string, unknown>
			config?: Record<string, unknown>
		}) => {
			const res = await api.projects[":project"].integrations[":slug"].$patch({
				param: { project: input.projectSlug, slug: input.slug },
				json: body,
			})
			if (!res.ok) {
				const data = (await res.json().catch(() => null)) as {
					message?: string
				} | null
				throw new Error(data?.message ?? "Failed to update integration")
			}
			return res.json()
		},
		onSettled: () =>
			Promise.all([
				input.queryClient.invalidateQueries({
					queryKey: integrationQueryKeys.bySlug(input.projectSlug, input.slug),
				}),
				invalidateProjectIntegrationsQueries(
					input.queryClient,
					input.projectSlug,
				),
			]),
	})
}

export function deleteProjectIntegrationMutationOptions(input: {
	projectSlug: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: integrationMutationKeys.delete(input.projectSlug),
		mutationFn: async (body: { slug: string; force?: boolean }) => {
			const res = await api.projects[":project"].integrations[":slug"].$delete({
				param: { project: input.projectSlug, slug: body.slug },
				query: body.force ? { force: "true" } : {},
			})
			if (!res.ok) {
				const data = (await res.json().catch(() => null)) as {
					message?: string
				} | null
				throw new Error(data?.message ?? "Failed to delete integration")
			}
			return res.json()
		},
		onSettled: () =>
			invalidateProjectIntegrationsQueries(
				input.queryClient,
				input.projectSlug,
			),
	})
}
