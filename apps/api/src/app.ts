import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { compress } from "hono/compress"
import { cors } from "hono/cors"
import { authRoutes, invitationRoutes, onboardingRoutes } from "./auth"
import { changeSetRoutes } from "./changesets/routes"
import { eventsRoutes, projectEventsRoutes } from "./events/routes"
import { integrationRoutes } from "./integrations"
import { env } from "./lib/env"
import { mcpHttp } from "./mcp/http"
import { requireActor } from "./middleware/auth"
import { errorHandler } from "./middleware/error"
import { logger } from "./middleware/logger"
import { requireProject } from "./middleware/project"
import { requestId } from "./middleware/request-id"
import { onboardingChecklistRoutes } from "./onboarding"
import { operationsRoutes, projectOperationsRoutes } from "./operations/routes"
import { projectRoutes } from "./projects/routes"
import { resourceRoutes } from "./resources/routes"
import { providersRoutes } from "./schema/routes"
import { thinkingBlockRoutes } from "./thinking-blocks/routes"
import type { AppEnv } from "./types"

const base = new Hono<AppEnv>()

base.use("*", requestId())
base.use("*", logger())
base.use(
	"*",
	cors({
		origin: env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		exposeHeaders: ["X-Request-ID"],
		credentials: true,
		maxAge: 86400,
	}),
)
base.use("*", compress())
// srvx (Nitro's Node adapter) hands handlers a NodeRequest that spoofs
// `Symbol.hasInstance` for Request. Hono's bodyLimit reconstructs the body
// path via `new Request(c.req.raw, …)`; on Node 24 undici then reads its
// private #state off the spoofed object and throws. Swap in srvx's real
// undici Request (its documented `_request` accessor) before bodyLimit.
base.use("*", async (c, next) => {
	const raw = c.req.raw as Request & { _request?: Request }
	if (raw._request) {
		c.req.raw = raw._request
	}
	return next()
})
base.use(
	"*",
	bodyLimit({
		maxSize: env.MAX_REQUEST_BODY_SIZE,
		onError: (c) => c.json({ error: "Payload too large", status: 413 }, 413),
	}),
)
base.get("/health", (c) => c.json({ status: "ok" }))

// `{.+}` (not `/*`) requires a child segment so bare /projects/:project
// routes bypass requireProject — the handlers resolve the slug themselves
// and --force on a missing slug must stay idempotent.
const api = new Hono<AppEnv>()
	.use("*", requireActor())
	.use("/projects/:project/:rest{.+}", requireProject())
	.route("/projects", projectRoutes)
	.route("/projects", changeSetRoutes)
	.route("/projects", resourceRoutes)
	.route("/projects", integrationRoutes)
	.route("/projects", projectOperationsRoutes)
	.route("/projects", projectEventsRoutes)
	.route("/events", eventsRoutes)
	.route("/operations", operationsRoutes)
	.route("/providers", providersRoutes)
	.route("/onboarding", onboardingChecklistRoutes)

// authRoutes, /mcp, and /onboarding each run their own auth check, so they
// mount on `base` (before requireActor) rather than on `api`.
const app = base
	.route("/", authRoutes)
	.route("/thinking-block", thinkingBlockRoutes)
	.all("/mcp", (c) => mcpHttp(c.req.raw))
	.route("/onboarding", onboardingRoutes)
	.route("/invitations", invitationRoutes)
	.route("/", api)

app.notFound((c) => c.json({ error: "Not found", status: 404 }, 404))

app.onError(errorHandler)

export { app }
export type AppType = typeof app
export type { OperationUpdateNotification } from "./operations"
export type { ResourceTypeArtifacts as ResourceTypeArtifactsResponse } from "./resources/artifacts"
export type { ResourceFieldLayoutLlmOutput } from "./resources/artifacts/field-layout/block"
export type { SearchHit, TypeIdentityResponse } from "./schema"
