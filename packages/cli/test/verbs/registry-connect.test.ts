import { describe, expect, mock, test } from "bun:test"
import { InvalidInput } from "@opsy/contracts/errors"
import { type FakeOutput, fakeDeps } from "@shell/deps.fake"
import { registryConnect } from "../../src/verbs/get/handlers"
import { respond } from "./helpers"

// Two-variant source discriminator: the chosen mode determines which fields
// are auto-minted (createGeneratedFieldsByMode) and whether onboarding fires.
const awsSchema = {
	provider: "aws",
	providerSource: "hashicorp/aws",
	providerVersion: "5.0.0",
	credentialDiscriminator: "source",
	credentials: {
		anyOf: [
			{
				properties: { source: { const: "static" } },
				required: ["source", "access_key", "secret_key"],
			},
			{
				properties: { source: { const: "assume_role" } },
				required: ["source", "role_arn"],
			},
		],
	},
	config: {},
	credentialForm: {
		preferredMode: "assume_role",
		createHiddenFieldsByMode: { assume_role: ["external_id"] },
		createGeneratedFieldsByMode: {
			assume_role: { external_id: { kind: "uuid" } },
		},
	},
	onboarding: {
		kind: "assume_role_trust_policy",
		externalIdField: "external_id",
	},
}

const onboardingArtifacts = {
	principalArn: "arn:aws:iam::123:root",
	externalId: "uuid-fixed",
	document: '{"Version":"2012-10-17"}',
	permissionsPolicyArn: "arn:aws:iam::aws:policy/AdministratorAccess",
	cloudformation: { launchUrl: "https://console.aws.amazon.com/launch" },
}

const staticSchema = {
	provider: "cloudflare",
	providerSource: "cloudflare/cloudflare",
	providerVersion: "4.0.0",
	credentialDiscriminator: null,
	credentials: { required: ["api_token"] },
	config: {},
	credentialForm: { preferredMode: "api_token" },
	onboarding: null,
}

describe("verbs/get/registryConnect (opsy registry connect)", () => {
	test("assume_role mode: mints external_id, feeds it to onboarding, skeleton carries it flat", async () => {
		const onboarding = mock(() => Promise.resolve(respond(onboardingArtifacts)))
		const deps = fakeDeps({
			randomUUID: () => "uuid-fixed",
			client: {
				providers: {
					":provider": {
						"integration-schema": {
							$get: () => Promise.resolve(respond(awsSchema)),
						},
						onboarding: { ":onboardingKind": { $get: onboarding } },
					},
				},
			} as never,
		})

		await registryConnect(deps, "aws", { format: "json" })

		expect(onboarding).toHaveBeenCalledWith({
			param: { provider: "aws", onboardingKind: "assume_role_trust_policy" },
			query: { external_id: "uuid-fixed" },
		})
		const bundle = JSON.parse((deps.output as FakeOutput).stdoutMem.value)
		expect(bundle).toEqual({
			provider: "aws",
			providerVersion: "5.0.0",
			mode: "assume_role",
			credentialsSchema: awsSchema.credentials,
			configSchema: awsSchema.config,
			onboarding: onboardingArtifacts,
			// Skeleton: source discriminator set, role_arn placeholder blank,
			// external_id auto-minted at top level (the same uuid the onboarding
			// card displays).
			credentials: {
				source: "assume_role",
				role_arn: "",
				external_id: "uuid-fixed",
			},
		})
	})

	test("static-credential provider: no onboarding call, schema + skeleton only", async () => {
		const deps = fakeDeps({
			randomUUID: () => "unused",
			client: {
				providers: {
					":provider": {
						"integration-schema": {
							$get: () => Promise.resolve(respond(staticSchema)),
						},
						// onboarding intentionally unstubbed: throwingClient fails
						// loudly if setup wrongly calls it for a static provider.
					},
				},
			} as never,
		})

		await registryConnect(deps, "cloudflare", { format: "json" })

		const bundle = JSON.parse((deps.output as FakeOutput).stdoutMem.value)
		expect(bundle.onboarding).toBeNull()
		expect(bundle.mode).toBe("api_token")
		expect(bundle.credentials).toEqual({ api_token: "" })
		expect(bundle.credentialsSchema).toEqual(staticSchema.credentials)
		expect(bundle.configSchema).toEqual(staticSchema.config)
	})

	test("no credential modes at all → InvalidInput (exit 5)", async () => {
		const bareSchema = {
			provider: "x",
			providerSource: "x/x",
			providerVersion: "1.0.0",
			credentialDiscriminator: null,
			credentials: {},
			config: {},
			credentialForm: undefined,
			onboarding: null,
		}
		const deps = fakeDeps({
			client: {
				providers: {
					":provider": {
						"integration-schema": {
							$get: () => Promise.resolve(respond(bareSchema)),
						},
					},
				},
			} as never,
		})
		await expect(registryConnect(deps, "x", {})).rejects.toBeInstanceOf(
			InvalidInput,
		)
	})
})
