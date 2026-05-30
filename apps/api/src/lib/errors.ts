import {
	BridgeDiagnosticError,
	BridgeTransportError,
} from "@opsy/bridge-client"

export function isAbortError(err: unknown): boolean {
	return err instanceof DOMException && err.name === "AbortError"
}

// Thrown by the import service when Terraform (or a provider) reports that the
// external providerId doesn't exist. The boundary maps this to HTTP 400 so
// callers get a request-time rejection instead of 201 + later failure.
export class ImportNotFoundError extends Error {
	readonly code = "ImportNotFound"
	readonly providerId: string
	readonly cause?: unknown
	constructor(message: string, providerId: string, cause?: unknown) {
		super(message)
		this.name = "ImportNotFoundError"
		this.providerId = providerId
		this.cause = cause
	}
}

// Mapped to HTTP 404 by the lookup route boundary.
export class LookupNotFoundError extends Error {
	readonly code = "LookupNotFound"
	readonly type: string
	readonly selector: Record<string, unknown>
	constructor(type: string, selector: Record<string, unknown>) {
		super(`no matching ${type} found for selector`)
		this.name = "LookupNotFoundError"
		this.type = type
		this.selector = selector
	}
}

const NOT_FOUND_PATTERN =
	/not[\s-]*found|non[- ]?existent|does not exist|NoSuchEntity|NotFound/i

export function classifyImportError(
	err: unknown,
	providerId: string,
): ImportNotFoundError | null {
	if (err instanceof BridgeDiagnosticError) {
		const hit = err.diagnostics.find(
			(d) =>
				d.severity === "error" &&
				NOT_FOUND_PATTERN.test(`${d.summary ?? ""} ${d.detail ?? ""}`),
		)
		if (hit) {
			return new ImportNotFoundError(
				hit.summary ?? hit.detail ?? err.message,
				providerId,
				err,
			)
		}
	}
	if (err instanceof Error && /no imported resources/i.test(err.message)) {
		return new ImportNotFoundError(err.message, providerId, err)
	}
	return null
}

export function describeBridgeError(err: unknown): {
	message: string
	code: string
	details: unknown
} {
	if (err instanceof BridgeDiagnosticError) {
		return {
			message: err.message,
			code: "BridgeDiagnosticError",
			details: err.diagnostics,
		}
	}
	if (err instanceof BridgeTransportError) {
		return {
			message: err.message,
			code: "BridgeTransportError",
			details: null,
		}
	}
	return {
		message: err instanceof Error ? err.message : String(err),
		code: "Unknown",
		details: null,
	}
}
