import { describe, expect, test } from "bun:test"
import { describeOperationError } from "@/operations/operations"

// describeOperationError is the normalization point feeding failed resource operations:
// it must strip the Vercel Workflow step wrapper and the AWS HTTP envelope so
// the changeset UI shows only the actionable cause (only `message` is rendered
// to users — see view.ts getChangeSetItemApplyResult / shell/changeset.ts).

describe("describeOperationError", () => {
	test("strips the step wrapper and HTTP envelope down to the api error", () => {
		const e = new Error(
			'Step "step//./src/resources/steps//applyResource" failed after 0 retries: creating S3 Bucket (opsy-rrtest-BAD): operation error S3: CreateBucket, https response error StatusCode: 400, RequestID: 123MH8TAPWCM96TP, HostID: 6jtP2xob, api error InvalidBucketName: The specified bucket is not valid.',
		)
		expect(describeOperationError(e)).toEqual({
			message: "InvalidBucketName: The specified bucket is not valid.",
			code: "InvalidBucketName",
			details: null,
		})
	})

	test("handles the FatalError: prefix variant", () => {
		const e = new Error(
			'FatalError: Step "step//x//applyResource" failed after 2 retries: api error AccessDenied: User is not authorized to perform: s3:CreateBucket',
		)
		const out = describeOperationError(e)
		expect(out.code).toBe("AccessDenied")
		expect(out.message).toBe(
			"AccessDenied: User is not authorized to perform: s3:CreateBucket",
		)
	})

	test("strips the wrapper even when there is no AWS api error", () => {
		const e = new Error(
			'Step "step//x//updateResourceInputs" failed after 1 retries: connection refused',
		)
		expect(describeOperationError(e)).toEqual({
			message: "connection refused",
			code: "Error",
			details: null,
		})
	})

	test("'exceeded max retries' with no cause keeps the raw message (no info to lose)", () => {
		const e = new Error(
			'Step "step//x//applyResource" exceeded max retries (1 retry)',
		)
		const out = describeOperationError(e)
		expect(out.message).toBe(
			'Step "step//x//applyResource" exceeded max retries (1 retry)',
		)
	})

	test("unwraps a .cause chain to the root error", () => {
		const root = new Error("api error Throttling: Rate exceeded")
		const wrapped = new Error('Step "step//x" failed after 0 retries')
		;(wrapped as Error & { cause: unknown }).cause = root
		const out = describeOperationError(wrapped)
		expect(out.code).toBe("Throttling")
		expect(out.message).toBe("Throttling: Rate exceeded")
	})

	test("a clean non-wrapped error passes through unchanged", () => {
		const e = new Error("resource not found: abc")
		expect(describeOperationError(e)).toEqual({
			message: "resource not found: abc",
			code: "Error",
			details: null,
		})
	})

	test("non-Error input is stringified safely", () => {
		expect(describeOperationError("boom")).toEqual({
			message: "boom",
			code: "Error",
			details: null,
		})
	})
})
