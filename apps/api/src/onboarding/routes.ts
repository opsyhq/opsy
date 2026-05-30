import { Hono } from "hono"
import type { AppEnv } from "../types"
import { onboardingService } from "."

// Mounted under /onboarding on the requireActor()-protected router (see app.ts).
// The unrelated POST /onboarding (create-org-on-signup) lives in auth/onboarding.ts
// and is mounted before requireActor — different middleware, different concern,
// no path collision (this module owns /status and /complete).
export const onboardingChecklistRoutes = new Hono<AppEnv>()
	.get("/status", async (c) => {
		const status = await onboardingService.getOnboardingStatus(c.get("actor"))
		return c.json(status)
	})
	.post("/complete", async (c) => {
		await onboardingService.markOnboardingComplete(c.get("actor"))
		return c.json({ ok: true })
	})
