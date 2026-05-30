import { describe, expect, test } from "bun:test"
import {
	apiError,
	authExpired,
	EXIT_CODE,
	exitCodeForError,
	networkError,
} from "@core/errors"
import {
	AuthUnauthorized,
	InvalidInput,
	OperationLockAlreadyInflight,
	OperationNotFound,
} from "@opsy/contracts/errors"

describe("exitCodeForError", () => {
	test("typed OpsyError → category via contracts HTTP status", () => {
		expect(
			exitCodeForError(new OperationNotFound({ operationId: "op-1" })),
		).toBe(EXIT_CODE.NOT_FOUND)
		expect(exitCodeForError(new AuthUnauthorized())).toBe(EXIT_CODE.AUTH)
		expect(exitCodeForError(new InvalidInput({ detail: "bad" }))).toBe(
			EXIT_CODE.VALIDATION,
		)
		expect(
			exitCodeForError(new OperationLockAlreadyInflight({ lockKey: "k" })),
		).toBe(EXIT_CODE.CONFLICT)
	})

	test("CliError helpers", () => {
		expect(exitCodeForError(authExpired())).toBe(EXIT_CODE.AUTH)
		expect(exitCodeForError(networkError(new Error("ECONNREFUSED")))).toBe(
			EXIT_CODE.NETWORK,
		)
	})

	test("untyped API_ERROR inherits the server's HTTP status", () => {
		expect(exitCodeForError(apiError(404, "nope"))).toBe(EXIT_CODE.NOT_FOUND)
		expect(exitCodeForError(apiError(409, "conflict"))).toBe(EXIT_CODE.CONFLICT)
		expect(exitCodeForError(apiError(400, "bad input"))).toBe(
			EXIT_CODE.VALIDATION,
		)
		expect(exitCodeForError(apiError(500, "boom"))).toBe(EXIT_CODE.GENERIC)
	})

	test("unknown values → generic", () => {
		expect(exitCodeForError(new Error("x"))).toBe(EXIT_CODE.GENERIC)
		expect(exitCodeForError("string")).toBe(EXIT_CODE.GENERIC)
		expect(exitCodeForError(undefined)).toBe(EXIT_CODE.GENERIC)
	})
})
