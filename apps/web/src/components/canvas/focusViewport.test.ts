import { describe, expect, it } from "vitest"
import { focusViewportFor } from "./focusViewport"

describe("focusViewportFor", () => {
	const baseInput = {
		flowRect: { left: 0, right: 1600, top: 0, bottom: 900 },
		nodeRect: { left: 100, top: 100, width: 120, height: 60 },
		viewport: { x: 0, y: 0, zoom: 1 },
		windowInnerWidth: 1920,
		appRailWidth: 52,
		activityRailWidth: 48,
		detailPanelWidth: 800,
	}

	it("targets the configured zoom", () => {
		expect(focusViewportFor(baseInput).zoom).toBe(2)
	})

	it("respects targetZoom override", () => {
		expect(focusViewportFor({ ...baseInput, targetZoom: 1.5 }).zoom).toBe(1.5)
	})

	it("accounts for the detail panel by shifting the visible center leftward", () => {
		const withPanel = focusViewportFor(baseInput)
		const withoutPanel = focusViewportFor({ ...baseInput, detailPanelWidth: 0 })
		expect(withPanel.x).toBeLessThan(withoutPanel.x)
	})

	it("accounts for the viewport translation", () => {
		const shifted = focusViewportFor({
			...baseInput,
			viewport: { x: 200, y: 100, zoom: 1 },
		})
		const unshifted = focusViewportFor(baseInput)
		// A viewport offset slides the node in canvas coords, which the targetZoom
		// then magnifies — so the output x/y must differ.
		expect(shifted.x).not.toBe(unshifted.x)
		expect(shifted.y).not.toBe(unshifted.y)
	})
})
