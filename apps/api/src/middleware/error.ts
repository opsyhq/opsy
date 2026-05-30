import { isOpsyError, type OpsyError, toHttp } from "@opsy/contracts/errors"
import type { ErrorHandler } from "hono"
import { HTTPException } from "hono/http-exception"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { RefError } from "../lib/refs/errors"
import type { AppEnv } from "../types"

function safeJsonValue(value: unknown, depth = 0): unknown {
	if (depth > 5) return undefined
	if (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return value
	}
	if (Array.isArray(value)) {
		return value
			.map((item) => safeJsonValue(item, depth + 1))
			.filter((item) => item !== undefined)
	}
	if (
		typeof value === "object" &&
		Object.getPrototypeOf(value) === Object.prototype
	) {
		const out: Record<string, unknown> = {}
		for (const [key, item] of Object.entries(value)) {
			const safe = safeJsonValue(item, depth + 1)
			if (safe !== undefined) out[key] = safe
		}
		return out
	}
	return undefined
}

function safeApiCause(cause: unknown): { code?: string; details?: unknown } {
	if (
		!cause ||
		typeof cause !== "object" ||
		Object.getPrototypeOf(cause) !== Object.prototype
	) {
		return {}
	}
	const record = cause as Record<string, unknown>
	const out: { code?: string; details?: unknown } = {}
	if (
		typeof record.code === "string" &&
		/^[a-z][a-z0-9_]*$/.test(record.code)
	) {
		out.code = record.code
	}
	if ("details" in record) {
		const details = safeJsonValue(record.details)
		if (details !== undefined) out.details = details
	}
	return out
}

// Wire shape: { error, code, status, _tag, message, ...payload }. Clients key off
// `_tag` (CLI deserialize, web throwingJsonTagged); `code`/`error`/`status` stay
// for legacy consumers.
function opsyErrorBody(err: OpsyError) {
	const { status, body } = toHttp(err)
	const { _tag, message, ...payload } = body
	return {
		status,
		body: { error: message, code: _tag, status, _tag, message, ...payload },
	}
}

// Severity follows HTTP status. 5xx is ours to fix (error); auth, conflict and
// rate-limit deserve a look (warn); routine 4xx is normal client traffic and
// stays at debug so it never pollutes prod logs at the default level — the
// request logger already records every request's status line regardless.
function levelForStatus(status: number): "error" | "warn" | "debug" {
	if (status >= 500) return "error"
	if (status === 401 || status === 403 || status === 409 || status === 429) {
		return "warn"
	}
	return "debug"
}

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
	const log = c.get("logger")
	if (isOpsyError(err)) {
		const { status, body } = opsyErrorBody(err)
		if (log) {
			log[levelForStatus(status)]({ _tag: err._tag, status }, err.message)
		}
		return c.json(body, status as ContentfulStatusCode)
	}
	if (err instanceof HTTPException || err instanceof RefError) {
		const apiCause = err instanceof HTTPException ? safeApiCause(err.cause) : {}
		const code = apiCause.code ?? "api_error"
		if (log) {
			log[levelForStatus(err.status)]({ status: err.status, code }, err.message)
		}
		return c.json(
			{
				error: err.message,
				code,
				status: err.status,
				...(apiCause.details !== undefined
					? { details: apiCause.details }
					: {}),
			},
			err.status,
		)
	}
	if (log) {
		log.error({ err }, "unhandled error")
	}
	return c.json(
		{ error: "Internal server error", code: "internal_error", status: 500 },
		500,
	)
}
