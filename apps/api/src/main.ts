import { app } from "./app"
import { env } from "./lib/env"
import { startApiRuntime } from "./runtime/api"

await startApiRuntime()

const fetch = app.fetch

export { fetch }

export default {
	port: env.PORT,
	// Default 10s kills any handler that hasn't emitted response bytes yet —
	// including long apply/import calls that block on the bridge. 0 disables.
	idleTimeout: 0,
	fetch,
}
