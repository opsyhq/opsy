import { describe, expect, test } from "bun:test"
import { InvalidInput } from "@opsy/contracts/errors"
import { type FakeOutput, fakeDeps } from "@shell/deps.fake"
import { Command } from "commander"
import { resourceCommand } from "../../src/domains/resource"
import { describeResource } from "../../src/verbs/describe/handlers"
import { getResource } from "../../src/verbs/get/handlers"
import { respond } from "./helpers"

// `resource get` collapses summary vs rich detail behind one subcommand.
// Both paths emit the same `{ resource }` envelope (one entity, one shape) —
// summary → getResource; --detail / the hidden `describe` alias →
// describeResource. The difference is what's inside, not the wrapper.
const payload = { slug: "my-bucket", type: "aws_s3_bucket", inputs: null }

async function out(argv: string[]): Promise<unknown> {
	const deps = fakeDeps({
		client: {
			projects: {
				":project": {
					resources: {
						":slug": { $get: () => Promise.resolve(respond(payload)) },
					},
				},
			},
		} as never,
	})
	const program = new Command()
	program.addCommand(resourceCommand())
	program.setOptionValue("_deps", deps)
	await program.parseAsync(argv, { from: "user" })
	return JSON.parse((deps.output as FakeOutput).stdoutMem.value)
}

describe("domains/resource get [--detail] dispatch", () => {
	test("get (no flag) → summary handler ({ resource } wrapper)", async () => {
		expect(
			await out([
				"resource",
				"get",
				"my-bucket",
				"--project",
				"demo",
				"-F",
				"json",
			]),
		).toEqual({ resource: payload })
	})

	test("get --detail → describe handler ({ resource } wrapper)", async () => {
		expect(
			await out([
				"resource",
				"get",
				"my-bucket",
				"--detail",
				"--project",
				"demo",
				"-F",
				"json",
			]),
		).toEqual({ resource: payload })
	})

	test("hidden `describe` alias forces detail", async () => {
		expect(
			await out([
				"resource",
				"describe",
				"my-bucket",
				"--project",
				"demo",
				"-F",
				"json",
			]),
		).toEqual({ resource: payload })
	})
})

describe("resource get --output <dotpath> accessor", () => {
	const view = {
		slug: "my-bucket",
		type: "aws_s3_bucket",
		inputs: null,
		outputs: { arn: "arn:aws:s3:::my-bucket", versioning: false },
	}
	const depsFor = () =>
		fakeDeps({
			client: {
				projects: {
					":project": {
						resources: {
							":slug": { $get: () => Promise.resolve(respond(view)) },
						},
					},
				},
			} as never,
		})

	test("prints the raw scalar, newline-terminated, no JSON wrapper", async () => {
		const deps = depsFor()
		await getResource(deps, "my-bucket", {
			project: "demo",
			output: "outputs.arn",
		})
		expect((deps.output as FakeOutput).stdoutMem.value).toBe(
			"arn:aws:s3:::my-bucket\n",
		)
	})

	test("a falsy-but-present value still prints (not treated as missing)", async () => {
		const deps = depsFor()
		await getResource(deps, "my-bucket", {
			project: "demo",
			output: "outputs.versioning",
		})
		expect((deps.output as FakeOutput).stdoutMem.value).toBe("false\n")
	})

	test("a missing path is InvalidInput (→ exit 5 via the taxonomy)", async () => {
		const deps = depsFor()
		await expect(
			getResource(deps, "my-bucket", {
				project: "demo",
				output: "outputs.nope",
			}),
		).rejects.toBeInstanceOf(InvalidInput)
	})
})

describe("resource describe — $ref annotation", () => {
	const view = {
		slug: "app",
		type: "aws_instance",
		outputs: null,
		inputs: { subnet: { $ref: "net.subnet_id" }, name: "web" },
		// What the server attaches when it substituted the ref.
		inlinedInputs: { subnet: "subnet-0abc", name: "web" },
	}
	const deps = fakeDeps({
		client: {
			projects: {
				":project": {
					resources: {
						":slug": { $get: () => Promise.resolve(respond(view)) },
					},
				},
			},
		} as never,
	})

	test("resolved ref renders as `<value> (slug.path)`, inputs untouched", async () => {
		await describeResource(deps, "app", { project: "demo" })
		const stdout = (deps.output as FakeOutput).stdoutMem.value
		expect(stdout).toContain('"subnet": "subnet-0abc (net.subnet_id)"')
		// the literal, non-ref value passes through verbatim
		expect(stdout).toContain('"name": "web"')
	})
})
