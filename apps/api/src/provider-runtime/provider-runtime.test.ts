import { afterEach, describe, expect, test } from "bun:test"
import type { BridgeClient, ResourceSchema } from "@opsy/bridge-client"
import { ProviderUnknown } from "@opsy/contracts/errors"
import { listProviders as listSchemaProviders } from "../schema/provider-catalog"
import {
	clearTerraformRuntimeCacheForTest,
	providerRefFromCreateBody,
	providerRuntime,
	setTerraformBridgeClientForTest,
	setTerraformProviderCatalogForTest,
} from "."

const fakeProviderSchema: ResourceSchema = {
	version: 0,
	block: {
		attributes: {
			token: { type: "string", optional: true, sensitive: true },
			region: { type: "string", optional: true },
		},
	},
}

const fakeResourceSchemas: Record<string, ResourceSchema> = {
	dyn_widget: {
		version: 0,
		block: {
			attributes: {
				id: { type: "string", computed: true },
				name: { type: "string", required: true },
			},
		},
	},
}

const fakeDataSourceSchemas: Record<string, ResourceSchema> = {
	dyn_lookup: {
		version: 0,
		block: {
			attributes: {
				id: { type: "string", computed: true },
				name: { type: "string", required: true },
			},
		},
	},
}

function fakeSchemaBridge(extra: Partial<BridgeClient> = {}): BridgeClient {
	return {
		getSummary: async (req) => ({
			provider_source: req.provider_source,
			provider_version: req.provider_version,
			resource_count: Object.keys(fakeResourceSchemas).length,
			data_source_count: Object.keys(fakeDataSourceSchemas).length,
			server_capabilities: {
				plan_destroy: false,
				get_provider_schema_optional: true,
				move_resource_state: false,
			},
		}),
		searchTypes: async () => ({
			results: [
				{ type: "dyn_lookup", kinds: ["data"] },
				{ type: "dyn_widget", kinds: ["resource"] },
			],
			truncated: false,
		}),
		resolveType: async (req) => ({
			type: req.type,
			kinds: [
				...(fakeResourceSchemas[req.type] ? ["resource" as const] : []),
				...(fakeDataSourceSchemas[req.type] ? ["data" as const] : []),
			],
		}),
		getTypeSchema: async (req) => ({
			type: req.type,
			kind: req.kind,
			schema:
				req.kind === "resource"
					? fakeResourceSchemas[req.type]
					: fakeDataSourceSchemas[req.type],
		}),
		getProviderConfigSchema: async () => ({ schema: fakeProviderSchema }),
		...extra,
	} as BridgeClient
}

afterEach(() => {
	setTerraformBridgeClientForTest(null)
	setTerraformProviderCatalogForTest(null)
	clearTerraformRuntimeCacheForTest()
})

describe("TerraformDynamicRuntime", () => {
	test("loads provider summary for allowlisted Terraform refs", async () => {
		let summaryCalls = 0
		const bridge = fakeSchemaBridge({
			getSummary: async (req) => {
				summaryCalls++
				expect(req).toEqual({
					provider_source: "example/dyn",
					provider_version: "1.2.3",
				})
				return {
					provider_source: req.provider_source,
					provider_version: req.provider_version,
					resource_count: 1,
					data_source_count: 1,
					server_capabilities: {
						plan_destroy: false,
						get_provider_schema_optional: true,
						move_resource_state: false,
					},
				}
			},
		})
		setTerraformBridgeClientForTest(bridge)
		setTerraformProviderCatalogForTest([
			{ name: "dyn", source: "example/dyn", versions: ["1.2.3"] },
		])

		const ref = providerRefFromCreateBody({
			provider: "dyn",
			providerVersion: "1.2.3",
		})
		const provider = await providerRuntime.require(ref)

		expect(provider.info).toEqual({
			tfSource: "example/dyn",
			version: "1.2.3",
		})
		expect(provider.capabilities).toEqual({
			resourceCount: 1,
			dataSourceCount: 1,
		})
		expect(summaryCalls).toBe(1)
		await providerRuntime.require(ref)
		expect(summaryCalls).toBe(1)
	})

	test("rejects Terraform refs outside the allowlist", () => {
		setTerraformProviderCatalogForTest([])
		expect(() =>
			providerRefFromCreateBody({
				provider: "dyn",
				providerSource: "example/dyn",
				providerVersion: "1.2.3",
			}),
		).toThrow(ProviderUnknown)
	})

	test("lists one default ref per multi-version provider", () => {
		setTerraformProviderCatalogForTest([
			{
				name: "aws",
				source: "hashicorp/aws",
				versions: ["6.44.0", "6.45.0"],
			},
			{ name: "null", source: "hashicorp/null", versions: ["3.2.3"] },
		])

		expect(providerRuntime.listInstalled()).toEqual([
			{ name: "aws", source: "hashicorp/aws", version: "6.44.0" },
			{ name: "null", source: "hashicorp/null", version: "3.2.3" },
		])
	})

	test("schema provider list returns one row with all installed versions", async () => {
		const bridge = fakeSchemaBridge()
		setTerraformBridgeClientForTest(bridge)
		setTerraformProviderCatalogForTest([
			{
				name: "aws",
				source: "hashicorp/aws",
				versions: ["6.44.0", "6.45.0"],
			},
		])

		const { providers } = await listSchemaProviders()

		expect(providers).toEqual([
			{
				name: "aws",
				source: "hashicorp/aws",
				version: "6.44.0",
				versions: ["6.44.0", "6.45.0"],
				resourceCount: 1,
				dataSourceCount: 1,
			},
		])
	})

	test("routes generic Terraform plan through bridge with merged provider config", async () => {
		const bridge = fakeSchemaBridge({
			planResource: async (req: {
				provider_source: string
				provider_version: string
				provider_config: Record<string, unknown>
				type: string
				config: unknown
			}) => {
				expect(req.provider_source).toBe("example/dyn")
				expect(req.provider_version).toBe("1.2.3")
				expect(req.provider_config).toEqual({
					region: "eu-west-1",
					token: "secret",
				})
				expect(req.type).toBe("dyn_widget")
				expect(req.config).toEqual({ name: "one" })
				return {
					planned_state: { id: null, name: "one" },
					planned_private: "opaque",
					requires_replace: [],
				}
			},
		})
		setTerraformBridgeClientForTest(bridge)
		setTerraformProviderCatalogForTest([
			{ name: "dyn", source: "example/dyn", versions: ["1.2.3"] },
		])

		const ref = providerRefFromCreateBody({
			provider: "dyn",
			providerVersion: "1.2.3",
		})
		const result = await providerRuntime.dispatch(
			ref,
			{
				kind: "Plan",
				type: "dyn_widget",
				priorState: null,
				proposedState: { name: "one" },
				config: { name: "one" },
			},
			{
				integration: {
					provider: "dyn",
					credentials: { token: "secret" },
					config: { region: "eu-west-1" },
					providerVersion: "1.2.3",
				},
			},
		)

		expect(result.payload).toEqual({
			plannedState: { id: null, name: "one" },
			plannedPrivate: "opaque",
			requiresReplace: [],
		})
	})

	test("shapes AWS static credentials for Terraform provider config", async () => {
		const bridge = fakeSchemaBridge({
			planResource: async (req: {
				provider_config: Record<string, unknown>
			}) => {
				expect(req.provider_config).toEqual({
					region: "us-west-2",
					access_key: "AKIAEXAMPLE00000",
					secret_key: "secret",
					token: "session",
				})
				expect("mode" in req.provider_config).toBe(false)
				expect("session_token" in req.provider_config).toBe(false)
				return {
					planned_state: { id: null, name: "one" },
					planned_private: "opaque",
					requires_replace: [],
				}
			},
		})
		setTerraformBridgeClientForTest(bridge)
		setTerraformProviderCatalogForTest([
			{ name: "aws", source: "hashicorp/aws", versions: ["6.44.0"] },
		])

		await providerRuntime.dispatch(
			providerRefFromCreateBody({
				provider: "aws",
				providerVersion: "6.44.0",
			}),
			{
				kind: "Plan",
				type: "dyn_widget",
				priorState: null,
				proposedState: { name: "one" },
				config: { name: "one" },
			},
			{
				integration: {
					provider: "aws",
					credentials: {
						source: "static",
						access_key: "AKIAEXAMPLE00000",
						secret_key: "secret",
						session_token: "session",
					},
					config: { region: "us-west-2" },
					providerVersion: "6.44.0",
				},
			},
		)
	})

	test("shapes AWS assume_role credentials for Terraform provider config", async () => {
		const bridge = fakeSchemaBridge({
			planResource: async (req: {
				provider_config: Record<string, unknown>
			}) => {
				expect(req.provider_config).toEqual({
					region: "eu-central-1",
					assume_role: [
						{
							role_arn: "arn:aws:iam::123456789012:role/OpsyRole",
							external_id: "external",
							session_name: "opsy-test",
						},
					],
				})
				expect("mode" in req.provider_config).toBe(false)
				expect("role_arn" in req.provider_config).toBe(false)
				expect("access_key" in req.provider_config).toBe(false)
				return {
					planned_state: { id: null, name: "one" },
					planned_private: "opaque",
					requires_replace: [],
				}
			},
		})
		setTerraformBridgeClientForTest(bridge)
		setTerraformProviderCatalogForTest([
			{ name: "aws", source: "hashicorp/aws", versions: ["6.44.0"] },
		])

		await providerRuntime.dispatch(
			providerRefFromCreateBody({
				provider: "aws",
				providerVersion: "6.44.0",
			}),
			{
				kind: "Plan",
				type: "dyn_widget",
				priorState: null,
				proposedState: { name: "one" },
				config: { name: "one" },
			},
			{
				integration: {
					provider: "aws",
					credentials: {
						source: "assume_role",
						role_arn: "arn:aws:iam::123456789012:role/OpsyRole",
						external_id: "external",
						session_name: "opsy-test",
					},
					config: { region: "eu-central-1" },
					providerVersion: "6.44.0",
				},
			},
		)
	})
})
