import { describe, expect, test } from "bun:test"
import { apiError, CliError } from "@core/errors"
import {
	isOpsyError,
	OperationLockAlreadyInflight,
	OperationNotFound,
	serialize,
} from "@opsy/contracts/errors"

describe("apiError", () => {
	test("hydrates tagged-error JSON bodies into OpsyError instances", () => {
		const original = new OperationNotFound({ operationId: "op-42" })
		const err = apiError(404, JSON.stringify(serialize(original)))
		expect(isOpsyError(err)).toBe(true)
		if (!isOpsyError(err)) throw new Error("unreachable")
		expect(err).toBeInstanceOf(OperationNotFound)
		expect(err._tag).toBe("OperationNotFound")
		expect((err as OperationNotFound).operationId).toBe("op-42")
	})

	test("roundtrips a payload with extra fields", () => {
		const original = new OperationLockAlreadyInflight({ lockKey: "resource:1" })
		const err = apiError(409, JSON.stringify(serialize(original)))
		expect(err).toBeInstanceOf(OperationLockAlreadyInflight)
		expect((err as OperationLockAlreadyInflight).lockKey).toBe("resource:1")
	})

	test("falls back to CliError when tag is unknown", () => {
		const wire = JSON.stringify({
			_tag: "NotARealTag",
			message: "something broke",
		})
		const err = apiError(500, wire)
		expect(err).toBeInstanceOf(CliError)
		expect(err.message).toBe("something broke")
	})

	test("keeps the legacy plain-text path", () => {
		const err = apiError(403, "forbidden")
		expect(err).toBeInstanceOf(CliError)
		expect(err.message).toMatch(/403/)
	})

	test("returns authExpired() on 401 with a non-tagged body", () => {
		const err = apiError(401, "unauthorized")
		expect(err).toBeInstanceOf(CliError)
		expect((err as CliError).code).toBe("AUTH_EXPIRED")
	})
})
