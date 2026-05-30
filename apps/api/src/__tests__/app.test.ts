import { describe, expect, test } from "bun:test"
import { app } from "../app"

describe("startup wiring", () => {
	test("does not seed relationship rules at boot", async () => {
		const mainSource = await Bun.file(
			new URL("../main.ts", import.meta.url),
		).text()
		for (const forbidden of [
			"seed" + "Curated",
			"relationship-rule-" + "seeds",
			"seeded " + "curated",
		]) {
			expect(mainSource).not.toContain(forbidden)
		}
	})
})

describe("GET /health", () => {
	test("returns 200 with status ok", async () => {
		const res = await app.request("/health")
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toEqual({ status: "ok" })
	})

	test("includes X-Request-ID header matching UUID format", async () => {
		const res = await app.request("/health")
		const requestId = res.headers.get("X-Request-ID")
		expect(requestId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		)
	})

	test("generates different request IDs for each request", async () => {
		const [res1, res2] = await Promise.all([
			app.request("/health"),
			app.request("/health"),
		])
		const id1 = res1.headers.get("X-Request-ID")
		const id2 = res2.headers.get("X-Request-ID")
		expect(id1).not.toBe(id2)
	})
})

describe("CORS", () => {
	test("allows project events stream preflight headers", async () => {
		const res = await app.request("/projects/project-id/events", {
			method: "OPTIONS",
			headers: {
				Origin: "http://localhost:3001",
				"Access-Control-Request-Method": "GET",
				"Access-Control-Request-Headers": "Authorization",
			},
		})

		expect(res.status).toBe(204)
		expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
			"Authorization",
		)
	})
})

// The legacy per-project operation SSE endpoints
// (`/projects/:project/operations/stream`, `/operations/:id/stream`) are gone —
// project-scoped streams flow through `/projects/:project/events`. The CLI's
// `watchOperationStatus` still hits `/events/operation/:id`, so that one stays.
describe("retired SSE endpoints", () => {
	test("operations router does not register the per-project legacy stream", async () => {
		const operationsRoutesSource = await Bun.file(
			new URL("../operations/routes.ts", import.meta.url),
		).text()
		expect(operationsRoutesSource).not.toContain("operations/stream")
		expect(operationsRoutesSource).not.toContain(":id/stream")
		expect(operationsRoutesSource).not.toContain("projectOperationEvents")
	})
})
