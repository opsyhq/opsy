import { isJsonOutput } from "@core/output/output-format"
import type { HandlerDeps } from "@core/types/deps"
import { ACTIVE_PROFILE, PROJECT } from "@shell/config"
import { gatherAuthStatus } from "../auth/handlers"

// "What am I pointed at" in one shot: the active profile/project (config) plus
// the resolved identity (auth), composed from the same `gatherAuthStatus`
// owner — no second probe, no drift. Deliberately omits apiUrl; that's an
// implementation detail and stays the `config view` escape hatch.
export async function showContext(
	deps: HandlerDeps,
	opts: { format?: string },
): Promise<void> {
	const status = await gatherAuthStatus()
	const authenticated =
		status.kind === "api-key" ||
		(status.kind === "session" && status.authenticated)
	const session =
		status.kind === "session" && status.authenticated ? status : null

	if (isJsonOutput(opts)) {
		deps.output.printJson({
			profile: ACTIVE_PROFILE,
			project: PROJECT ?? null,
			authenticated,
			...(session
				? {
						user: session.user,
						orgId: session.orgId,
						expiresAt: session.expiresAt,
					}
				: {}),
		})
		return
	}

	const rows: Array<[string, unknown]> = [
		["profile", ACTIVE_PROFILE],
		["project", PROJECT ?? "(not set)"],
		["authenticated", authenticated],
	]
	if (session) {
		rows.push(
			["user", session.user.email],
			["org id", session.orgId ?? ""],
			["expires at", session.expiresAt ?? ""],
		)
	}
	deps.output.keyValue(rows)
}
