import { describe, expect, test } from "bun:test"
import {
	deserialize,
	IntegrationDuplicateSlug,
	NotFound,
	OperationNotFound,
	type OpsyError,
	serialize,
	toHttp,
} from "../src"

describe("toHttp", () => {
	test("uses the status captured from the original throw site", () => {
		expect(toHttp(new OperationNotFound({ operationId: "op1" })).status).toBe(
			404,
		)
		expect(
			toHttp(
				new IntegrationDuplicateSlug({
					slug: "aws-prod",
					projectSlug: "p",
				}),
			).status,
		).toBe(409)
	})

	test("unknown tag defaults to 500", () => {
		const rogue = { _tag: "__Unknown__", message: "x" } as unknown as OpsyError
		expect(toHttp(rogue).status).toBe(500)
	})

	test("body carries _tag, message, and payload fields", () => {
		const err = new OperationNotFound({ operationId: "op1" })
		const { body } = toHttp(err)
		expect(body).toEqual({
			_tag: "OperationNotFound",
			message: "operation not found: op1",
			operationId: "op1",
		})
	})
})

describe("serialize / deserialize roundtrip", () => {
	test("roundtrips a simple variant with one field", () => {
		const err = new OperationNotFound({ operationId: "op-xyz" })
		const json = JSON.parse(JSON.stringify(serialize(err)))
		const hydrated = deserialize(json)
		expect(hydrated).toBeInstanceOf(OperationNotFound)
		expect(hydrated?._tag).toBe("OperationNotFound")
		expect(hydrated?.message).toBe("operation not found: op-xyz")
		expect((hydrated as OperationNotFound).operationId).toBe("op-xyz")
	})

	test("roundtrips a multi-field variant", () => {
		const err = new IntegrationDuplicateSlug({
			slug: "aws-prod",
			projectSlug: "infra",
		})
		const hydrated = deserialize(
			JSON.parse(JSON.stringify(serialize(err))),
		) as IntegrationDuplicateSlug
		expect(hydrated._tag).toBe("IntegrationDuplicateSlug")
		expect(hydrated.slug).toBe("aws-prod")
		expect(hydrated.projectSlug).toBe("infra")
		expect(hydrated.message).toBe(
			'integration with slug "aws-prod" already exists in project infra — pick a different slug',
		)
	})

	test("roundtrips a Common fallback variant", () => {
		const err = new NotFound({ detail: "opaque thing not found" })
		const hydrated = deserialize(
			JSON.parse(JSON.stringify(serialize(err))),
		) as NotFound
		expect(hydrated._tag).toBe("NotFound")
		expect(hydrated.detail).toBe("opaque thing not found")
	})

	test("unknown tag deserializes to null", () => {
		const hydrated = deserialize({ _tag: "NotAThing", message: "x" })
		expect(hydrated).toBeNull()
	})
})
