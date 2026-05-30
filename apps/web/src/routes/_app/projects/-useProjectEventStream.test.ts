import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { OperationDetailResponse } from "@/lib/operationReactQuery"
import type {
	ProjectOperationUpdate,
	ProjectResource,
} from "@/lib/projectReactQuery"
import type { ProjectEvent } from "@/lib/sse/fetch-sse"
import {
	createProjectEventHandler,
	type ProjectEventHandlerDeps,
	projectEventStreamUrl,
} from "./-useProjectEventStream"

describe("projectEventStreamUrl", () => {
	it("subscribes to the per-project events stream", () => {
		expect(projectEventStreamUrl("/api", "project 1")).toBe(
			"/api/projects/project%201/events",
		)
	})
})

function operationEvent(
	id: string,
	closedAt: string | null,
	status: ProjectOperationUpdate["status"] = closedAt ? "succeeded" : "running",
	kind: ProjectOperationUpdate["kind"] = "create",
): ProjectEvent {
	return {
		event: "operation.updated",
		data: { id, closedAt, status, kind } as unknown as ProjectOperationUpdate,
	}
}

function resource(id: string, slug: string): ProjectResource {
	return { id, slug } as unknown as ProjectResource
}

function opDetail(input: {
	closedAt: string | null
	status?: string
	kind?: string
	error?: Record<string, unknown> | null
	resourceSlug?: string | null
}): OperationDetailResponse {
	return {
		operation: {
			closedAt: input.closedAt,
			status: input.status ?? "running",
			kind: input.kind ?? "create",
			error: input.error,
		},
		resource: input.resourceSlug ? { slug: input.resourceSlug } : null,
	} as unknown as OperationDetailResponse
}

describe("createProjectEventHandler", () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	function makeDeps(overrides: Partial<ProjectEventHandlerDeps> = {}): {
		deps: ProjectEventHandlerDeps
		spies: {
			onFailure: ReturnType<typeof vi.fn>
			invalidateOperationsList: ReturnType<typeof vi.fn>
			invalidateOperationDetail: ReturnType<typeof vi.fn>
			fetchOperation: ReturnType<typeof vi.fn>
			patchResource: ReturnType<typeof vi.fn>
			removeResource: ReturnType<typeof vi.fn>
			invalidateChangesets: ReturnType<typeof vi.fn>
			resyncOnReconnect: ReturnType<typeof vi.fn>
		}
	} {
		const spies = {
			onFailure: vi.fn(),
			invalidateOperationsList: vi.fn(() => Promise.resolve()),
			invalidateOperationDetail: vi.fn(() => Promise.resolve()),
			fetchOperation: vi.fn(() =>
				Promise.resolve(opDetail({ closedAt: null })),
			),
			patchResource: vi.fn(),
			removeResource: vi.fn(),
			invalidateChangesets: vi.fn(() => Promise.resolve()),
			resyncOnReconnect: vi.fn(() => Promise.resolve()),
		}
		const deps: ProjectEventHandlerDeps = {
			invalidateOperationsList: spies.invalidateOperationsList,
			invalidateOperationDetail: spies.invalidateOperationDetail,
			fetchOperation: spies.fetchOperation,
			onFailure: spies.onFailure,
			patchResource: spies.patchResource,
			removeResource: spies.removeResource,
			invalidateChangesets: spies.invalidateChangesets,
			resyncOnReconnect: spies.resyncOnReconnect,
			...overrides,
		}
		return { deps, spies }
	}

	it("operation.updated invalidates operations list + detail without touching resources", async () => {
		const { deps, spies } = makeDeps()
		const handler = createProjectEventHandler(deps)

		handler.handleEvent(operationEvent("op1", null))
		await vi.runAllTimersAsync()

		expect(spies.invalidateOperationsList).toHaveBeenCalledTimes(1)
		expect(spies.invalidateOperationDetail).toHaveBeenCalledWith("op1")
		expect(spies.fetchOperation).not.toHaveBeenCalled()
		expect(spies.patchResource).not.toHaveBeenCalled()
		expect(spies.removeResource).not.toHaveBeenCalled()
		expect(spies.resyncOnReconnect).not.toHaveBeenCalled()
	})

	it("operation.updated does not fetch detail on successful terminal events", async () => {
		const { deps, spies } = makeDeps()
		const handler = createProjectEventHandler(deps)

		handler.handleEvent(
			operationEvent("op1", "2026-05-16T00:00:00Z", "succeeded"),
		)
		await vi.runAllTimersAsync()

		expect(spies.fetchOperation).not.toHaveBeenCalled()
		expect(spies.onFailure).not.toHaveBeenCalled()
	})

	it("operation.updated toasts on failed terminal events via fetchOperation", async () => {
		const { deps, spies } = makeDeps({
			fetchOperation: vi.fn(() =>
				Promise.resolve(
					opDetail({
						closedAt: "2026-05-16T00:00:00Z",
						status: "failed",
						kind: "create",
						error: { message: "bucket exists" },
						resourceSlug: "demo",
					}),
				),
			),
		})
		const handler = createProjectEventHandler(deps)

		handler.handleEvent(operationEvent("op1", "2026-05-16T00:00:00Z", "failed"))
		await vi.runAllTimersAsync()

		expect(spies.onFailure).toHaveBeenCalledWith(
			"create demo failed: bucket exists",
		)
	})

	it("resource.updated patches the cache without invalidating the list", async () => {
		const { deps, spies } = makeDeps()
		const handler = createProjectEventHandler(deps)

		const updated = resource("res1", "demo")
		handler.handleEvent({ event: "resource.updated", data: updated })
		await vi.runAllTimersAsync()

		expect(spies.patchResource).toHaveBeenCalledTimes(1)
		expect(spies.patchResource).toHaveBeenCalledWith(updated)
		expect(spies.invalidateOperationsList).not.toHaveBeenCalled()
		expect(spies.removeResource).not.toHaveBeenCalled()
		expect(spies.resyncOnReconnect).not.toHaveBeenCalled()
	})

	it("resource.created patches the cache (insert semantics live in the helper)", async () => {
		const { deps, spies } = makeDeps()
		const handler = createProjectEventHandler(deps)

		const created = resource("res2", "fresh")
		handler.handleEvent({ event: "resource.created", data: created })
		await vi.runAllTimersAsync()

		expect(spies.patchResource).toHaveBeenCalledWith(created)
	})

	it("resource.deleted removes the entry from both caches", async () => {
		const { deps, spies } = makeDeps()
		const handler = createProjectEventHandler(deps)

		handler.handleEvent({
			event: "resource.deleted",
			data: { id: "res1", projectId: "p1", slug: "demo" },
		})
		await vi.runAllTimersAsync()

		expect(spies.removeResource).toHaveBeenCalledWith({
			id: "res1",
			projectId: "p1",
			slug: "demo",
		})
		expect(spies.patchResource).not.toHaveBeenCalled()
	})

	it("changeset.updated invalidates the changesets query", async () => {
		const { deps, spies } = makeDeps()
		const handler = createProjectEventHandler(deps)

		handler.handleEvent({
			event: "changeset.updated",
			data: { id: "cs1", projectId: "p1" },
		})
		await vi.runAllTimersAsync()

		expect(spies.invalidateChangesets).toHaveBeenCalledTimes(1)
	})

	it("handleReconnect triggers a list resync; patches between reconnects still apply", async () => {
		const { deps, spies } = makeDeps()
		const handler = createProjectEventHandler(deps)

		handler.handleReconnect()
		await vi.runAllTimersAsync()
		expect(spies.resyncOnReconnect).toHaveBeenCalledTimes(1)

		const r = resource("res1", "demo")
		handler.handleEvent({ event: "resource.updated", data: r })
		await vi.runAllTimersAsync()
		expect(spies.patchResource).toHaveBeenCalledWith(r)
	})
})
