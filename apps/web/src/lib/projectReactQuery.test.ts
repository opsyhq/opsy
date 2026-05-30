import type { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import {
	invalidateProjectIntegrationsQueries,
	invalidateProjectOperationsQueries,
	invalidateProjectQueries,
	invalidateProjectResourcesQueries,
	projectMutationKeys,
	projectQueryKeys,
	projectResourcesQueryOptions,
	scanProjectMutationOptions,
} from "./projectReactQuery"

describe("projectQueryKeys", () => {
	it("scopes keys by domain and slug", () => {
		expect(projectQueryKeys.all).toEqual(["projects"])
		expect(projectQueryKeys.list()).toEqual(["projects", "list"])
		expect(projectQueryKeys.detail("foo")).toEqual([
			"projects",
			"detail",
			"foo",
		])
		expect(projectQueryKeys.resources("foo")).toEqual([
			"projects",
			"detail",
			"foo",
			"resources",
		])
		expect(projectQueryKeys.operations("foo")).toEqual([
			"projects",
			"detail",
			"foo",
			"operations",
		])
		expect(projectQueryKeys.integrations("foo")).toEqual([
			"projects",
			"detail",
			"foo",
			"integrations",
		])
	})

	it("nests resources keys under detail so slug-wide invalidation cascades", () => {
		const detail = projectQueryKeys.detail("foo")
		const resources = projectQueryKeys.resources("foo")
		expect(resources.slice(0, detail.length)).toEqual(detail)
	})
})

describe("projectMutationKeys", () => {
	it("includes the slug for per-project mutations", () => {
		expect(projectMutationKeys.create()).toEqual([
			"projects",
			"mutation",
			"create",
		])
		expect(projectMutationKeys.update("foo")).toEqual([
			"projects",
			"mutation",
			"update",
			"foo",
		])
		expect(projectMutationKeys.scan("foo")).toEqual([
			"projects",
			"mutation",
			"scan",
			"foo",
		])
	})

	it("exposes the project-wide scan mutation", () => {
		const { client } = mockQueryClient()
		expect(
			scanProjectMutationOptions({ slug: "foo", queryClient: client })
				.mutationKey,
		).toEqual(projectMutationKeys.scan("foo"))
	})
})

describe("projectResourcesQueryOptions", () => {
	it("scopes the resources query under the project detail key", () => {
		const options = projectResourcesQueryOptions({ slug: "opsy" })
		expect(options.queryKey).toEqual(projectQueryKeys.resources("opsy"))
	})

	it("does not poll or refetch while fresh; explicit invalidation refreshes", () => {
		const options = projectResourcesQueryOptions({ slug: "opsy" })
		expect(options.refetchInterval).toBeUndefined()
		expect(options.staleTime).toBe(Number.POSITIVE_INFINITY)
	})
})

function mockQueryClient() {
	const invalidateQueries = vi.fn().mockResolvedValue(undefined)
	return {
		client: { invalidateQueries } as unknown as QueryClient,
		invalidateQueries,
	}
}

describe("invalidate helpers", () => {
	it("invalidateProjectQueries scopes to slug detail when provided", () => {
		const { client, invalidateQueries } = mockQueryClient()
		invalidateProjectQueries(client, { slug: "foo" })
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: projectQueryKeys.detail("foo"),
		})
	})

	it("invalidateProjectQueries falls back to the domain root", () => {
		const { client, invalidateQueries } = mockQueryClient()
		invalidateProjectQueries(client)
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: projectQueryKeys.all,
		})
	})

	it("invalidateProjectResourcesQueries targets the resources subtree", () => {
		const { client, invalidateQueries } = mockQueryClient()
		invalidateProjectResourcesQueries(client, "foo")
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: projectQueryKeys.resources("foo"),
		})
	})

	it("invalidateProjectOperationsQueries targets the operations subtree", () => {
		const { client, invalidateQueries } = mockQueryClient()
		invalidateProjectOperationsQueries(client, "foo")
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: projectQueryKeys.operations("foo"),
		})
	})

	it("invalidateProjectIntegrationsQueries targets the integrations subtree", () => {
		const { client, invalidateQueries } = mockQueryClient()
		invalidateProjectIntegrationsQueries(client, "foo")
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: projectQueryKeys.integrations("foo"),
		})
	})
})
