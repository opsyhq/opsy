import {
	isOpsyError,
	type OpsyError,
	toHttp,
	tryDeserialize,
} from "@opsy/contracts/errors"

export class CliError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly hint?: string,
		// HTTP status of the originating API failure, when this CliError wraps
		// one. Lets `exitCodeForError` classify even the generic API_ERROR
		// fallback off the status the server actually returned.
		public readonly status?: number,
	) {
		super(message)
		this.name = "CliError"
	}
}

export const authExpired = () =>
	new CliError(
		"Session expired",
		"AUTH_EXPIRED",
		'Run "opsy auth login" to re-authenticate',
	)

type ZodIssueLike = { path?: ReadonlyArray<string | number>; message?: string }

// Fallback for older servers that emit raw `issues[]`.
function formatLegacyIssues(issues: ReadonlyArray<ZodIssueLike>): string {
	return issues
		.map((i) => {
			const path = i.path && i.path.length > 0 ? i.path.join(".") : "(root)"
			return `${path}: ${i.message ?? "invalid"}`
		})
		.join("; ")
}

export const apiError = (
	status: number,
	body: unknown,
): OpsyError | CliError => {
	type ApiErrorBody = {
		error?: string
		code?: string
		message?: string
		hint?: string
		issues?: ReadonlyArray<ZodIssueLike>
		_tag?: string
	}
	let parsed: ApiErrorBody | null = null
	if (typeof body === "string") {
		try {
			parsed = JSON.parse(body) as ApiErrorBody
		} catch {
			parsed = null
		}
	} else if (body && typeof body === "object") {
		parsed = body as ApiErrorBody
	}
	const hydrated = tryDeserialize(parsed)
	if (hydrated) return hydrated
	// Session bearer expired or was rejected — user-facing message and
	// hint ("run opsy auth login") are more useful than a raw 401 dump.
	if (status === 401) return authExpired()
	const fallback =
		parsed?.issues && parsed.issues.length > 0
			? formatLegacyIssues(parsed.issues)
			: undefined
	const structured = parsed?.error ?? parsed?.message ?? fallback
	const message =
		structured ??
		`API error ${status}: ${typeof body === "string" ? body : JSON.stringify(body)}`
	return new CliError(message, "API_ERROR", parsed?.hint, status)
}

export const networkError = (
	cause: unknown,
	ctx?: { url: string; method?: string; status?: number },
) => {
	const causeMsg = cause instanceof Error ? cause.message : String(cause)
	const urlStr = ctx?.url ?? ""
	const status = ctx?.status

	let message: string
	if (
		status === undefined &&
		(causeMsg.includes("fetch failed") || causeMsg.includes("ECONNREFUSED"))
	) {
		message = `Server unreachable at ${urlStr}. Is the API running?`
	} else if (status === 401 || status === 403) {
		message = `Auth failed (status ${status}) at ${urlStr}. Re-run \`opsy login\` or check OPSY_API_KEY.`
	} else if (status !== undefined && status >= 500) {
		message = `Server error (status ${status}) at ${urlStr}.`
	} else {
		message = `Network error: ${causeMsg}${urlStr ? ` (${urlStr})` : ""}`
	}

	return new CliError(message, "NETWORK_ERROR")
}

// CLI process exit codes. 0 (success) and 2 (awaiting approval) are owned by
// shell/exit.ts; this taxonomy covers failures so scripts can branch on `$?`
// instead of sniffing the error body. Categories derive from the error's HTTP
// status — the single source of truth is the contracts STATUS map, read via
// the public `toHttp()` for typed OpsyErrors, or the status captured into
// CliError for untyped API failures. No parallel per-tag table to drift.
export const EXIT_CODE = {
	GENERIC: 1,
	AUTH: 3,
	NOT_FOUND: 4,
	VALIDATION: 5,
	NETWORK: 6,
	CONFLICT: 7,
	// `opsy changeset wait` exit codes — distinct so agents can branch on $?
	// for the two "settled but unhealthy" cases without parsing stderr.
	DRY_RUN_TIMEOUT: 8,
	DRY_RUN_ERROR: 9,
} as const

function exitCodeForStatus(status: number): number {
	if (status === 401 || status === 403) return EXIT_CODE.AUTH
	if (status === 404) return EXIT_CODE.NOT_FOUND
	if (status === 400 || status === 422) return EXIT_CODE.VALIDATION
	if (status === 409) return EXIT_CODE.CONFLICT
	return EXIT_CODE.GENERIC
}

export function exitCodeForError(err: unknown): number {
	if (isOpsyError(err)) return exitCodeForStatus(toHttp(err).status)
	if (err instanceof CliError) {
		if (err.code === "NETWORK_ERROR") return EXIT_CODE.NETWORK
		if (err.code === "AUTH_EXPIRED") return EXIT_CODE.AUTH
		if (err.code === "DRY_RUN_TIMEOUT") return EXIT_CODE.DRY_RUN_TIMEOUT
		if (err.code === "DRY_RUN_ERROR") return EXIT_CODE.DRY_RUN_ERROR
		if (typeof err.status === "number") return exitCodeForStatus(err.status)
		return EXIT_CODE.GENERIC
	}
	return EXIT_CODE.GENERIC
}

const TAG_HINTS: Partial<Record<OpsyError["_tag"], string>> = {
	OperationLockAlreadyInflight:
		'an operation is already running on this resource — run "opsy operation list" to see it, or "opsy operation cancel <id>" to abort.',
	AuthUnauthorized: 'run "opsy auth login" to authenticate.',
	AuthApiKeyInvalid:
		"the API key was rejected — check OPSY_API_KEY or rotate the key.",
	AuthApiKeyNoOrg: "this API key is not bound to an organization.",
	AuthNoActiveOrg:
		'no active organization — run "opsy auth login" to select one.',
	AuthDeviceCodeExpired: 'rerun "opsy auth login" to start a new device flow.',
	AuthDeviceCodeAccessDenied:
		'login was denied in the browser — rerun "opsy auth login" to retry.',
	AuthDeviceCodeInvalidGrant:
		'rerun "opsy auth login" to start a new device flow.',
	AuthDeviceCodeTimeout:
		'login timed out — rerun "opsy auth login" and approve faster.',
	AuthDeviceCodeRequestFailed:
		"check your network connection or the API URL configuration.",
	OperationNotFound: 'run "opsy operation list" to see recent operations.',
	ResourceNotFound: 'run "opsy resource list" to see available resources.',
	ProjectNotFound: 'run "opsy project list" to see available projects.',
	IntegrationNotFound:
		'run "opsy integration list" to see configured integrations.',
}

export function hintForTag(tag: OpsyError["_tag"]): string | undefined {
	return TAG_HINTS[tag]
}

export { isOpsyError }
