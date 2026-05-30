import { afterEach, describe, expect, test } from "bun:test"
import { setHttpDebugEnabled, setHttpDebugSink } from "@shell/debug"
import { opsyFetch } from "../src/client"

const originalFetch = globalThis.fetch
const originalApiKey = process.env.OPSY_API_KEY

afterEach(() => {
	globalThis.fetch = originalFetch
	if (originalApiKey === undefined) delete process.env.OPSY_API_KEY
	else process.env.OPSY_API_KEY = originalApiKey
	setHttpDebugEnabled(false)
	setHttpDebugSink()
})

describe("opsyFetch debug output", () => {
	test("logs safe request diagnostics without headers, query strings, or bodies", async () => {
		const lines: string[] = []
		process.env.OPSY_API_KEY = "opsy_secret_token"
		setHttpDebugEnabled(true)
		setHttpDebugSink((line) => lines.push(line))
		globalThis.fetch = (async () =>
			new Response("{}", { status: 201 })) as typeof fetch

		await opsyFetch(
			"https://api.example.test/api/projects/demo?api_key=secret",
			{
				method: "POST",
				headers: {
					Authorization: "Bearer caller_secret",
					"X-Api-Key": "caller_api_key",
				},
				body: JSON.stringify({ password: "body_secret" }),
			},
		)

		const debug = lines.join("")
		expect(debug).toContain(
			"[debug] POST /api/projects/demo status=201 duration=",
		)
		expect(debug).not.toContain("api_key")
		expect(debug).not.toContain("secret")
		expect(debug).not.toContain("Authorization")
		expect(debug).not.toContain("X-Api-Key")
		expect(debug).not.toContain("password")
		expect(debug).not.toContain("body_secret")
	})

	test("does not log when debug is disabled", async () => {
		const lines: string[] = []
		setHttpDebugEnabled(false)
		setHttpDebugSink((line) => lines.push(line))
		globalThis.fetch = (async () =>
			new Response("{}", { status: 200 })) as typeof fetch

		await opsyFetch("https://api.example.test/api/projects/demo", {
			method: "GET",
		})

		expect(lines).toEqual([])
	})
})
