import { expect, test } from "bun:test"
import type { Integration } from "../src/integration"
import { providerConfigForIntegration } from "../src"

const AWS = { name: "aws", source: "hashicorp/aws" }

function integration(
	credentials: Record<string, unknown>,
	config: Record<string, unknown> = {},
): Integration {
	return { provider: "aws", credentials, config }
}

function providerConfig(
	credentials: Record<string, unknown>,
	config: Record<string, unknown> = {},
) {
	return providerConfigForIntegration(AWS, integration(credentials, config))
}

test("static credentials project to exactly access_key/secret_key/token/region", () => {
	expect(
		providerConfig(
			{
				mode: "static",
				access_key: "AKIAEXAMPLE00000",
				secret_key: "secret",
				session_token: "session",
			},
			{ region: "us-west-2" },
		),
	).toEqual({
		region: "us-west-2",
		access_key: "AKIAEXAMPLE00000",
		secret_key: "secret",
		token: "session",
	})
})

test("static credentials omit token when no session_token; region defaults", () => {
	const cfg = providerConfig({
		mode: "static",
		access_key: "AKIAEXAMPLE00000",
		secret_key: "secret",
	})
	expect(cfg).toEqual({
		region: "us-east-1",
		access_key: "AKIAEXAMPLE00000",
		secret_key: "secret",
	})
	expect("token" in cfg).toBe(false)
})

test("assume_role projects to the assume_role block; session_name defaults to opsy", () => {
	expect(
		providerConfig(
			{
				mode: "assume_role",
				role_arn: "arn:aws:iam::123456789012:role/OpsyRole",
				external_id: "external",
			},
			{ region: "eu-central-1" },
		),
	).toEqual({
		region: "eu-central-1",
		assume_role: [
			{
				role_arn: "arn:aws:iam::123456789012:role/OpsyRole",
				external_id: "external",
				session_name: "opsy",
			},
		],
	})
})

// --- Security: the loose-JSON passthrough is closed -------------------------

test("rejects extra credential keys (no smuggled AWS provider args)", () => {
	expect(() =>
		providerConfig({
			mode: "static",
			access_key: "AKIAEXAMPLE00000",
			secret_key: "secret",
			// hashicorp/aws provider arg that must never reach ConfigureProvider
			endpoints: [{ sts: "https://attacker.example" }],
		}),
	).toThrow()
})

test("rejects extra config keys (config is region-only)", () => {
	expect(() =>
		providerConfig(
			{
				mode: "static",
				access_key: "AKIAEXAMPLE00000",
				secret_key: "secret",
			},
			{
				region: "us-east-1",
				shared_credentials_files: ["/proc/self/environ"],
			},
		),
	).toThrow()
})

test("rejects an unrecognized credential mode (no else passthrough)", () => {
	expect(() =>
		providerConfig({
			mode: "totally-not-a-mode",
			access_key: "AKIAEXAMPLE00000",
			secret_key: "secret",
			assume_role_with_web_identity: { web_identity_token_file: "/etc/x" },
		}),
	).toThrow()
})

test("rejects empty credentials (no silent ambient-host-cred fallback)", () => {
	expect(() => providerConfig({})).toThrow()
})

test("rejects missing mode even when otherwise valid-looking", () => {
	expect(() =>
		providerConfig({
			access_key: "AKIAEXAMPLE00000",
			secret_key: "secret",
		}),
	).toThrow()
})
