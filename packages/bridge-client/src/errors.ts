// See diagnostics.ts — Nitro's main + workflow-step bundles each carry their
// own copy of this class. Branded with Symbol.for so `instanceof` works
// across realms.
const BRIDGE_TRANSPORT_ERROR_BRAND = Symbol.for("opsy.BridgeTransportError")

export class BridgeTransportError extends Error {
	readonly [BRIDGE_TRANSPORT_ERROR_BRAND] = true
	readonly status: number
	readonly body: string
	constructor(path: string, status: number, body: string) {
		super(`bridge ${path} returned HTTP ${status}: ${body}`)
		this.name = "BridgeTransportError"
		this.status = status
		this.body = body
	}

	static [Symbol.hasInstance](value: unknown): boolean {
		return (
			typeof value === "object" &&
			value !== null &&
			(value as { [BRIDGE_TRANSPORT_ERROR_BRAND]?: unknown })[
				BRIDGE_TRANSPORT_ERROR_BRAND
			] === true
		)
	}
}

export function coerceError(err: unknown): Error {
	return err instanceof Error ? err : new Error(String(err))
}

export function toAbortError(reason: unknown): Error {
	if (reason instanceof Error) return reason
	const err = new Error(typeof reason === "string" ? reason : "aborted")
	err.name = "AbortError"
	return err
}
