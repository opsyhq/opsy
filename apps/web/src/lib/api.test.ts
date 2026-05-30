import {
	isOpsyError,
	OperationNotFound,
	serialize,
} from "@opsy/contracts/errors"
import { describe, expect, it } from "vitest"
import { throwingJson } from "./api"

function jsonRes(body: unknown, status = 500): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	})
}

describe("throwingJson", () => {
	it("hydrates tagged-error bodies into OpsyError instances", async () => {
		const original = new OperationNotFound({ operationId: "op-7" })
		const res = jsonRes(serialize(original), 404)
		await expect(throwingJson(res, "fallback")).rejects.toSatisfy((err) => {
			if (!isOpsyError(err)) return false
			return err._tag === "OperationNotFound"
		})
	})

	it("falls through to plain Error on unknown tag", async () => {
		const res = jsonRes({ _tag: "Mystery", message: "boom" }, 500)
		await expect(throwingJson(res, "fallback")).rejects.toThrow(/boom/)
	})

	it("returns parsed json when ok", async () => {
		const res = new Response(JSON.stringify({ hello: "world" }), {
			status: 200,
			headers: { "content-type": "application/json" },
		})
		await expect(throwingJson(res, "fallback")).resolves.toEqual({
			hello: "world",
		})
	})
})
