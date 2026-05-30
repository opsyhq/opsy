import type { Logger } from "pino"
import type { Auth } from "./auth"
import type { Project } from "./lib/db/schema"

// Better Auth's session row, narrowed so `activeOrganizationId` is statically
// accessible instead of requiring an `as` cast at every call site. The field
// is injected by the organization plugin at runtime but doesn't flow through
// to the inferred type.
type AuthSessionResult = NonNullable<
	Awaited<ReturnType<Auth["api"]["getSession"]>>
>
export type AuthSessionRow = AuthSessionResult["session"] & {
	activeOrganizationId?: string | null
}

export type Actor = {
	type: "user" | "api_key" | "system"
	id: string
	orgId: string
	role?: string
	permissions?: string[]
	/** "browser" for cookie sessions, "bearer" for CLI device-flow tokens. */
	channel?: "browser" | "bearer"
}

type AppVariables = {
	requestId: string
	actor: Actor
	logger: Logger
	/** Set by `requireProject()` on `/projects/:project/*` routes. */
	project: Project
}
export type AppEnv = { Variables: AppVariables }
