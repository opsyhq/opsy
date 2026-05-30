import * as clack from "@clack/prompts"
import { OPSY_CLI_CLIENT_ID } from "@core/constants"
import { isJsonOutput } from "@core/output/output-format"
import type { HandlerDeps } from "@core/types/deps"
import {
	AuthDeviceCodeAccessDenied,
	AuthDeviceCodeExpired,
	AuthDeviceCodeInvalidGrant,
	AuthDeviceCodeInvalidRequest,
	AuthDeviceCodePollFailed,
	AuthDeviceCodeRequestFailed,
	AuthDeviceCodeTimeout,
} from "@opsy/contracts/errors"
import { authClient } from "@shell/auth-client"
import { API_URL } from "@shell/config"
import {
	clearCredentials,
	getAccessToken,
	loadCredentials,
	type StoredCredentials,
	saveCredentials,
} from "@shell/credentials"
import { cliError } from "@shell/exit"
import open from "open"

type SessionResponse = {
	user: { id: string; email: string; name?: string }
	session: {
		expiresAt?: string
		activeOrganizationId?: string | null
	}
}

async function fetchSession(
	token: string,
): Promise<{ data: SessionResponse | null; status: number; error?: string }> {
	try {
		const res = await fetch(`${API_URL}/api/auth/get-session`, {
			headers: { Authorization: `Bearer ${token}` },
		})
		if (!res.ok) return { data: null, status: res.status }
		return { data: (await res.json()) as SessionResponse, status: res.status }
	} catch (err) {
		return {
			data: null,
			status: 0,
			error: err instanceof Error ? err.message : String(err),
		}
	}
}

async function runDeviceFlow(): Promise<{
	access_token: string
	expires_in: number
}> {
	const { data: deviceCode, error: codeError } = await authClient.device.code({
		client_id: OPSY_CLI_CLIENT_ID,
		scope: "openid profile email",
	})
	if (codeError || !deviceCode) {
		throw new AuthDeviceCodeRequestFailed({
			detail:
				codeError?.error_description ?? codeError?.error ?? "unknown error",
		})
	}

	clack.intro("Logging in to Opsy")
	clack.note(
		`Your one-time code: ${deviceCode.user_code}\n\nVisit: ${deviceCode.verification_uri}`,
		"Verification",
	)

	await open(deviceCode.verification_uri_complete)

	const spinner = clack.spinner()
	spinner.start("Waiting for authentication...")

	const deadline = Date.now() + deviceCode.expires_in * 1000
	let pollInterval = deviceCode.interval

	while (Date.now() < deadline) {
		await sleep(pollInterval * 1000)

		const { data: tokens, error } = await authClient.device.token({
			grant_type: "urn:ietf:params:oauth:grant-type:device_code",
			device_code: deviceCode.device_code,
			client_id: OPSY_CLI_CLIENT_ID,
		})

		if (tokens) {
			spinner.stop("Authenticated")
			return tokens
		}

		switch (error?.error) {
			case "authorization_pending":
				continue
			case "slow_down":
				pollInterval += 5
				continue
			case "expired_token":
				throw new AuthDeviceCodeExpired()
			case "access_denied":
				throw new AuthDeviceCodeAccessDenied()
			case "invalid_grant":
				throw new AuthDeviceCodeInvalidGrant()
			case "invalid_request":
				throw new AuthDeviceCodeInvalidRequest({
					detail: error.error_description ?? "Invalid request.",
				})
			default:
				throw new AuthDeviceCodePollFailed({
					detail: error?.error ?? error?.error_description ?? "unknown",
				})
		}
	}

	throw new AuthDeviceCodeTimeout()
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function authLogin(_deps: HandlerDeps): Promise<void> {
	const tokens = await runDeviceFlow()
	const { data: session } = await fetchSession(tokens.access_token)
	const stored: StoredCredentials = {
		token: tokens.access_token,
		expiresAt:
			session?.session?.expiresAt ??
			new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
		user: {
			id: session?.user?.id ?? "",
			email: session?.user?.email ?? "",
			name: session?.user?.name,
		},
		orgId: session?.session?.activeOrganizationId ?? undefined,
	}
	saveCredentials(stored)
	clack.outro(`Logged in as ${stored.user.email || stored.user.id}`)
}

export async function authLogout(deps: HandlerDeps): Promise<void> {
	const creds = loadCredentials()
	if (creds?.token) {
		await fetch(`${API_URL}/api/auth/sign-out`, {
			method: "POST",
			headers: { Authorization: `Bearer ${creds.token}` },
		}).catch(() => undefined)
	}
	clearCredentials()
	deps.output.success("Logged out")
}

// Why a session probe failed, derived from the get-session response. Pure so
// both the union below and the human label read one source.
function probeReason(status: number, error?: string): string {
	if (error !== undefined) return "unreachable"
	if (status === 401) return "token_rejected"
	if (status >= 400 && status < 500) return "token_invalid"
	if (status >= 500) return "server_error"
	return `probe_failed_${status}`
}

export type AuthStatus =
	| { kind: "api-key" }
	| { kind: "anonymous" }
	| {
			kind: "session"
			authenticated: boolean
			user: StoredCredentials["user"]
			orgId?: string
			expiresAt?: string
			reason?: string
	  }

// Single owner of "who am I": env api-key short-circuit, then stored creds,
// then a live get-session probe. Returns data only — `authStatus` and
// `showContext` render it, so they can't drift on the auth decision.
export async function gatherAuthStatus(): Promise<AuthStatus> {
	if (process.env.OPSY_API_KEY) return { kind: "api-key" }
	const creds = loadCredentials()
	if (!creds) return { kind: "anonymous" }
	const { data, status, error } = await fetchSession(creds.token)
	const authenticated = !!data
	return {
		kind: "session",
		authenticated,
		user: creds.user,
		orgId: data?.session?.activeOrganizationId ?? creds.orgId,
		expiresAt: data?.session?.expiresAt ?? creds.expiresAt,
		reason: authenticated ? undefined : probeReason(status, error),
	}
}

export async function authStatus(
	deps: HandlerDeps,
	opts: { format?: string },
): Promise<void> {
	const status = await gatherAuthStatus()
	if (status.kind === "api-key") {
		if (isJsonOutput(opts)) {
			deps.output.printJson({ authenticated: true, mode: "api-key" })
			return
		}
		deps.output.keyValue([
			["authenticated", true],
			["mode", "api-key"],
		])
		return
	}
	if (status.kind === "anonymous") {
		if (isJsonOutput(opts)) {
			deps.output.printJson({ authenticated: false })
			return
		}
		deps.output.keyValue([["authenticated", false]])
		return
	}
	if (isJsonOutput(opts)) {
		deps.output.printJson({
			authenticated: status.authenticated,
			...(status.authenticated
				? { user: status.user }
				: { cachedUser: status.user, reason: status.reason }),
			orgId: status.orgId,
			expiresAt: status.expiresAt,
		})
		return
	}
	const userLabel = status.authenticated ? "user" : `user (${status.reason})`
	deps.output.keyValue([
		["authenticated", status.authenticated],
		[userLabel, status.user.email],
		["org id", status.orgId ?? ""],
		["expires at", status.expiresAt],
	])
}

export async function authToken(deps: HandlerDeps): Promise<void> {
	const token = await getAccessToken()
	if (!token) cliError(deps.output, "Not logged in")
	process.stdout.write(`${token}\n`)
}
