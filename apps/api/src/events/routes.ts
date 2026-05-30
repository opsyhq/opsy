import { Hono } from "hono"
import { streamJsonSse } from "../lib/sse"
import { validate } from "../lib/validation"
import * as operations from "../operations"
import { operationIdParam } from "../operations/schemas"
import { operationEvents } from "../operations/sse"
import type { AppEnv } from "../types"
import { projectEvents } from "./projectEvents"

// Per-operation SSE channel. The web client no longer uses this — it folds
// operation updates into the per-project stream below — but the CLI's
// `watchOperationStatus` still depends on it.
export const eventsRoutes = new Hono<AppEnv>().get(
	"/operation/:id",
	validate("param", operationIdParam),
	async (c) => {
		const actor = c.get("actor")
		const { operation } = await operations.getOperation(actor, c.req.param("id"))
		return streamJsonSse(c, (signal) =>
			operationEvents(actor, operation, signal),
		)
	},
)

// Unified per-project SSE stream. Replaces the legacy
// /projects/:project/operations/stream; folds operations + resources +
// changeset deltas onto a single channel keyed by the SSE `event:` line.
export const projectEventsRoutes = new Hono<AppEnv>().get(
	"/:project/events",
	async (c) => {
		const actor = c.get("actor")
		const project = c.get("project")
		return streamJsonSse(c, (signal) => projectEvents(actor, project, signal))
	},
)
