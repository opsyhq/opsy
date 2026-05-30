import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("architecture data loading", () => {
	it("keeps architecture fetching out of the canvas", () => {
		const routeSource = readFileSync(
			new URL("./index.tsx", import.meta.url),
			"utf8",
		)
		const canvasSource = readFileSync(
			new URL("./-ResourceCanvas.tsx", import.meta.url),
			"utf8",
		)
		const canvasModelSource = readFileSync(
			new URL("./-hooks/useCanvasModel.ts", import.meta.url),
			"utf8",
		)
		const canvasLayoutSource = readFileSync(
			new URL("./-hooks/useCanvasLayout.ts", import.meta.url),
			"utf8",
		)
		const canvasSelectionSource = readFileSync(
			new URL("./-hooks/useCanvasSelection.ts", import.meta.url),
			"utf8",
		)

		expect(routeSource).toContain("projectResourcesQueryOptions")
		expect(routeSource).toContain("useCanvasModel")
		for (const source of [
			canvasSource,
			canvasModelSource,
			canvasLayoutSource,
			canvasSelectionSource,
		]) {
			expect(source).not.toContain("projectResourcesQueryOptions")
			expect(source).not.toContain("useSuspenseQuery")
			expect(source).not.toContain("resources.$get")
		}
		expect(canvasModelSource).toContain("useQueries")
	})
})
