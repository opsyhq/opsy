import { beforeEach, expect, test } from "bun:test"
import type {
	BridgeClient,
	DataSourceReadRequest,
	DataSourceReadResponse,
	ProviderConfigSchemaRequest,
	ProviderConfigSchemaResponse,
	ProviderMetadataRequest,
	ProviderMetadataResponse,
	ProviderSummaryRequest,
	ProviderSummaryResponse,
	ProviderTypeIdentityRequest,
	ProviderTypeIdentityResponse,
	ProviderTypeResolveRequest,
	ProviderTypeResolveResponse,
	ProviderTypeSchemaRequest,
	ProviderTypeSchemaResponse,
	ProviderTypesSearchRequest,
	ProviderTypesSearchResponse,
	ProviderValidateRequest,
	ResourceApplyRequest,
	ResourceApplyResponse,
	ResourceIdentitySchema,
	ResourceImportRequest,
	ResourceImportResponse,
	ResourcePlanRequest,
	ResourcePlanResponse,
	ResourceReadRequest,
	ResourceReadResponse,
	ResourceSchema,
	ResourceValidateRequest,
	ValidateResponse,
} from "@opsy/bridge-client"
import { BridgeTransportError } from "@opsy/bridge-client"
import { composeProvider } from "../src"
import type { Integration } from "../src/integration"

// ─── Fake bridge ────────────────────────────────────────────────────────────

interface FakeState {
	lastSummary: ProviderSummaryRequest | null
	summaryCalls: number
	lastTypeSchema: ProviderTypeSchemaRequest | null
	typeSchemaCalls: number
	providerConfigSchemaCalls: number
	lastRead: ResourceReadRequest | null
	lastPlan: ResourcePlanRequest | null
	lastApply: ResourceApplyRequest | null
	lastImport: ResourceImportRequest | null
	lastDs: DataSourceReadRequest | null
}

interface FakeBridgeOptions {
	providerSchema?: ResourceSchema
	resources?: Record<string, ResourceSchema>
	dataSources?: Record<string, ResourceSchema>
	identities?: Record<string, ResourceIdentitySchema>
}

function makeFakeBridge(options: FakeBridgeOptions = {}): {
	bridge: BridgeClient
	state: FakeState
} {
	const state: FakeState = {
		lastSummary: null,
		summaryCalls: 0,
		lastTypeSchema: null,
		typeSchemaCalls: 0,
		providerConfigSchemaCalls: 0,
		lastRead: null,
		lastPlan: null,
		lastApply: null,
		lastImport: null,
		lastDs: null,
	}

	const providerSchema: ResourceSchema = options.providerSchema ?? {
		version: 0,
		block: {
			attributes: {
				region: { type: "string", optional: true },
				access_key: { type: "string", optional: true, sensitive: true },
			},
		},
	}
	const resources: Record<string, ResourceSchema> = options.resources ?? {
		fake_widget: {
			version: 0,
			block: { attributes: { id: { type: "string", computed: true } } },
		},
		fake_thing: {
			version: 0,
			block: { attributes: { id: { type: "string", computed: true } } },
		},
	}
	const dataSources: Record<string, ResourceSchema> = options.dataSources ?? {
		fake_lookup: {
			version: 0,
			block: { attributes: { name: { type: "string", required: true } } },
		},
		fake_thing: {
			version: 0,
			block: { attributes: { id: { type: "string", required: true } } },
		},
	}

	const bridge = {
		baseUrl: "http://fake",
		getMetadata(
			_req: ProviderMetadataRequest,
		): Promise<ProviderMetadataResponse> {
			throw new Error("not called in tests")
		},
		getSummary(req: ProviderSummaryRequest): Promise<ProviderSummaryResponse> {
			state.lastSummary = req
			state.summaryCalls += 1
			return Promise.resolve({
				provider_source: req.provider_source,
				provider_version: req.provider_version,
				resource_count: Object.keys(resources).length,
				data_source_count: Object.keys(dataSources).length,
				server_capabilities: {
					plan_destroy: false,
					get_provider_schema_optional: true,
					move_resource_state: false,
				},
			})
		},
		searchTypes(
			req: ProviderTypesSearchRequest,
		): Promise<ProviderTypesSearchResponse> {
			const q = req.q?.toLowerCase() ?? ""
			const kind = req.kind ?? "both"
			const names = new Set<string>()
			if (kind === "resource" || kind === "both") {
				for (const name of Object.keys(resources)) names.add(name)
			}
			if (kind === "data" || kind === "both") {
				for (const name of Object.keys(dataSources)) names.add(name)
			}
			const all = [...names]
				.filter((name) => name.toLowerCase().includes(q))
				.sort()
			const offset = req.offset ?? 0
			const limit = req.limit ?? 25
			return Promise.resolve({
				results: all.slice(offset, offset + limit).map((type) => ({
					type,
					kinds: [
						...(resources[type] ? ["resource" as const] : []),
						...(dataSources[type] ? ["data" as const] : []),
					],
				})),
				truncated: all.length > offset + limit,
			})
		},
		resolveType(
			req: ProviderTypeResolveRequest,
		): Promise<ProviderTypeResolveResponse> {
			const kinds = [
				...(resources[req.type] ? ["resource" as const] : []),
				...(dataSources[req.type] ? ["data" as const] : []),
			]
			return Promise.resolve({ type: req.type, kinds })
		},
		getTypeIdentity(
			req: ProviderTypeIdentityRequest,
		): Promise<ProviderTypeIdentityResponse> {
			// Mirrors the real bridge: identity is a per-resource-type lookup;
			// an unknown resource type is a 400, a known one with no advertised
			// identity omits the field (→ raw import-id fallback).
			if (!resources[req.type]) {
				return Promise.reject(
					new BridgeTransportError(
						"/providers/types/identity",
						400,
						`unknown provider type "${req.type}"`,
					),
				)
			}
			return Promise.resolve({
				type: req.type,
				identity: (options.identities ?? {})[req.type],
			})
		},
		getTypeSchema(
			req: ProviderTypeSchemaRequest,
		): Promise<ProviderTypeSchemaResponse> {
			state.lastTypeSchema = req
			state.typeSchemaCalls += 1
			const schemas = req.kind === "resource" ? resources : dataSources
			return Promise.resolve({
				type: req.type,
				kind: req.kind,
				schema: schemas[req.type],
			})
		},
		getProviderConfigSchema(
			_req: ProviderConfigSchemaRequest,
		): Promise<ProviderConfigSchemaResponse> {
			state.providerConfigSchemaCalls += 1
			return Promise.resolve({ schema: providerSchema })
		},
		validateProvider(_req: ProviderValidateRequest): Promise<ValidateResponse> {
			throw new Error("not called in tests")
		},
		validateResource(_req: ResourceValidateRequest): Promise<ValidateResponse> {
			throw new Error("not called in tests")
		},
		readResource(req: ResourceReadRequest): Promise<ResourceReadResponse> {
			state.lastRead = req
			return Promise.resolve({ new_state: { id: "i-read", foo: "bar" } })
		},
		planResource(req: ResourcePlanRequest): Promise<ResourcePlanResponse> {
			state.lastPlan = req
			return Promise.resolve({
				planned_state: { id: "i-planned", ami: "ami-123" },
				planned_private: "priv-blob",
				requires_replace: [["ami"]],
			})
		},
		applyResource(req: ResourceApplyRequest): Promise<ResourceApplyResponse> {
			state.lastApply = req
			return Promise.resolve({ new_state: { id: "i-applied" } })
		},
		importResource(
			req: ResourceImportRequest,
		): Promise<ResourceImportResponse> {
			state.lastImport = req
			return Promise.resolve({
				imported_resources: [
					{ type_name: req.type, state: { id: "i-imported" } },
				],
			})
		},
		readDataSource(
			req: DataSourceReadRequest,
		): Promise<DataSourceReadResponse> {
			state.lastDs = req
			return Promise.resolve({ state: { id: "ds-result" } })
		},
	} as unknown as BridgeClient

	return { bridge, state }
}

// ─── Shared test fixtures ───────────────────────────────────────────────────

const integration: Integration = {
	provider: "aws",
	credentials: { access_key: "AKIA", secret_key: "secret" },
	config: { region: "us-east-1" },
}

let fake: ReturnType<typeof makeFakeBridge>

beforeEach(() => {
	fake = makeFakeBridge()
})

function makeProvider(
	extra: Partial<Parameters<typeof composeProvider>[0]> = {},
) {
	return composeProvider({
		name: "fake",
		bridge: fake.bridge,
		tfSource: "fakecorp/fake",
		providerConfigFor: (i) => ({ ...i.config, ...i.credentials }),
		...extra,
	})
}

// ─── init() ────────────────────────────────────────────────────────────────

test("init() calls bridge.getSummary with the pinned source/version (no provider_config)", async () => {
	const provider = makeProvider()
	await provider.init("1.2.3")
	expect(fake.state.lastSummary).toEqual({
		provider_source: "fakecorp/fake",
		provider_version: "1.2.3",
	})
	expect(
		(fake.state.lastSummary as unknown as Record<string, unknown>)
			.provider_config,
	).toBeUndefined()
	expect(fake.state.summaryCalls).toBe(1)
})

test("init() is idempotent at the same version", async () => {
	const provider = makeProvider()
	await provider.init("1.2.3")
	await provider.init("1.2.3")
	expect(fake.state.summaryCalls).toBe(1)
})

test("init() at a different version replaces the registry", async () => {
	const provider = makeProvider()
	await provider.init("1.2.3")
	await provider.init("2.0.0")
	expect(fake.state.summaryCalls).toBe(2)
	expect(fake.state.lastSummary?.provider_version).toBe("2.0.0")
})

test("getType throws if called before init", async () => {
	const provider = makeProvider()
	await expect(provider.getType("fake_widget")).rejects.toThrow(/before init/)
})

// ─── Capabilities / metadata ──────────────────────────────────────────────

test("capabilities reflect manifest summary counts", async () => {
	const provider = makeProvider()
	await provider.init("1.0.0")
	expect(provider.capabilities).toEqual({
		resourceCount: 2,
		dataSourceCount: 2,
	})
})

test("getType returns metadata with capabilities", async () => {
	const provider = makeProvider()
	await provider.init("1.0.0")
	const widget = await provider.getType("fake_widget")
	expect(widget?.type).toBe("fake_widget")
	expect(widget?.capabilities.resource).toBe(true)
	expect(widget?.capabilities.data).toBe(false)
})

test("getType returns undefined for unknown types", async () => {
	const provider = makeProvider()
	await provider.init("1.0.0")
	expect(await provider.getType("fake_does_not_exist")).toBeUndefined()
})

test("getTypeIdentity returns the structured schema when advertised", async () => {
	const identity: ResourceIdentitySchema = {
		version: 1,
		attributes: [
			{
				name: "bucket",
				type: "string",
				required_for_import: true,
				description: "the bucket name",
			},
			{ name: "region", type: "string", optional_for_import: true },
		],
	}
	fake = makeFakeBridge({ identities: { fake_widget: identity } })
	const provider = makeProvider()
	await provider.init("1.0.0")
	expect(await provider.getTypeIdentity("fake_widget")).toEqual(identity)
})

test("getTypeIdentity returns null for a resource with no advertised identity", async () => {
	const provider = makeProvider()
	await provider.init("1.0.0")
	expect(await provider.getTypeIdentity("fake_widget")).toBeNull()
})

test("getTypeIdentity returns undefined for an unknown resource type", async () => {
	const provider = makeProvider()
	await provider.init("1.0.0")
	expect(await provider.getTypeIdentity("fake_does_not_exist")).toBeUndefined()
})

test("searchTypes returns bounded manifest-backed hits", async () => {
	const provider = makeProvider()
	await provider.init("1.0.0")
	const types = (
		await provider.searchTypes({ q: "fake", kind: "both", limit: 10 })
	).results.map((t) => t.type)
	expect(types).toEqual(["fake_lookup", "fake_thing", "fake_widget"])
})

// ─── dispatch: Plan / Apply / Read / Import / ReadData ────────────────────

test("dispatch Plan forwards type/state/provider ref to bridge and returns payload", async () => {
	const provider = makeProvider()
	await provider.init("6.44.0")
	const result = await provider.dispatch(
		{
			kind: "Plan",
			type: "fake_widget",
			priorState: null,
			proposedState: { ami: "ami-123" },
			config: { ami: "ami-123" },
		},
		{ integration },
	)
	expect(result.kind).toBe("Plan")
	expect(result.payload.plannedState).toEqual({
		id: "i-planned",
		ami: "ami-123",
	})
	expect(result.payload.plannedPrivate).toBe("priv-blob")
	expect(result.payload.requiresReplace).toEqual([["ami"]])
	expect(fake.state.lastPlan?.provider_source).toBe("fakecorp/fake")
	expect(fake.state.lastPlan?.provider_version).toBe("6.44.0")
	expect(fake.state.lastPlan?.prior_state).toBeNull()
})

test("dispatch Plan forwards null proposedState/config (destroy)", async () => {
	const provider = makeProvider()
	await provider.init("6.44.0")
	await provider.dispatch(
		{
			kind: "Plan",
			type: "fake_widget",
			priorState: { id: "i-old" },
			proposedState: null,
			config: null,
		},
		{ integration },
	)
	expect(fake.state.lastPlan?.proposed_new_state).toBeNull()
	expect(fake.state.lastPlan?.config).toBeNull()
})

test("dispatch Apply returns the applied state on create/update", async () => {
	const provider = makeProvider()
	await provider.init("6.44.0")
	const result = await provider.dispatch(
		{
			kind: "Apply",
			type: "fake_widget",
			priorState: null,
			plannedState: { id: "i-new" },
			plannedPrivate: "priv",
			config: {},
			actionKind: "create",
		},
		{ integration },
	)
	expect(result.kind).toBe("Apply")
	expect(result.payload.state).toEqual({ id: "i-applied" })
})

test("dispatch Apply returns null state on destroy actionKind", async () => {
	const fake2 = makeFakeBridge()
	fake2.bridge.applyResource = () =>
		Promise.resolve({ new_state: null }) as never
	fake = fake2
	const provider = makeProvider()
	await provider.init("6.44.0")
	const result = await provider.dispatch(
		{
			kind: "Apply",
			type: "fake_widget",
			priorState: { id: "i-old" },
			plannedState: null,
			plannedPrivate: null,
			config: null,
			actionKind: "delete",
		},
		{ integration },
	)
	expect(result.payload.state).toBeNull()
})

test("dispatch Read forwards current_state to bridge", async () => {
	const provider = makeProvider()
	await provider.init("6.44.0")
	const result = await provider.dispatch(
		{ kind: "Read", type: "fake_widget", state: { id: "i-abc" } },
		{ integration },
	)
	expect(result.payload.state).toEqual({ id: "i-read", foo: "bar" })
	expect(fake.state.lastRead?.current_state).toEqual({ id: "i-abc" })
})

test("dispatch Import returns the imported state", async () => {
	const provider = makeProvider()
	await provider.init("6.44.0")
	const result = await provider.dispatch(
		{ kind: "Import", type: "fake_widget", providerId: "i-abc123" },
		{ integration },
	)
	expect(result.kind).toBe("Import")
	expect(result.payload.state).toEqual({ id: "i-imported" })
	expect(fake.state.lastImport?.provider_id).toBe("i-abc123")
})

test("dispatch Import forwards structured identity instead of provider_id", async () => {
	const provider = makeProvider()
	await provider.init("6.44.0")
	const result = await provider.dispatch(
		{
			kind: "Import",
			type: "fake_widget",
			identity: { bucket: "my-bucket", region: "us-east-1" },
		},
		{ integration },
	)
	expect(result.payload.state).toEqual({ id: "i-imported" })
	expect(fake.state.lastImport?.identity).toEqual({
		bucket: "my-bucket",
		region: "us-east-1",
	})
	expect(fake.state.lastImport?.provider_id).toBeUndefined()
})

test("dispatch ReadData forwards selector to bridge", async () => {
	const provider = makeProvider()
	await provider.init("6.44.0")
	const result = await provider.dispatch(
		{ kind: "ReadData", type: "fake_lookup", selector: { owners: ["amazon"] } },
		{ integration },
	)
	expect(result.payload.state).toEqual({ id: "ds-result" })
	expect(fake.state.lastDs?.config).toEqual({ owners: ["amazon"] })
})

// ─── dispatch: capability gating ──────────────────────────────────────────

test("dispatch Plan on unknown type throws unknown_type", async () => {
	const provider = makeProvider()
	await provider.init("1.0.0")
	await expect(
		provider.dispatch(
			{
				kind: "Plan",
				type: "fake_nope",
				priorState: null,
				proposedState: null,
				config: null,
			},
			{ integration },
		),
	).rejects.toThrow(/unknown resource type/)
})

test("dispatch Plan on data-only type throws (not managed)", async () => {
	const provider = makeProvider()
	await provider.init("1.0.0")
	await expect(
		provider.dispatch(
			{
				kind: "Plan",
				type: "fake_lookup",
				priorState: null,
				proposedState: null,
				config: null,
			},
			{ integration },
		),
	).rejects.toThrow(/data source/)
})

// ─── Schema inspection accessors ───────────────────────────────────────────

test("getSchema returns resource-only schema for resource-only types", async () => {
	const provider = makeProvider()
	await provider.init("1.0.0")
	const s = await provider.getSchema("fake_widget")
	expect(s?.resource).toBeDefined()
	expect(s?.data).toBeUndefined()
})

test("getSchema returns data-only schema for data-only types", async () => {
	const provider = makeProvider()
	await provider.init("1.0.0")
	const s = await provider.getSchema("fake_lookup")
	expect(s?.resource).toBeUndefined()
	expect(s?.data).toBeDefined()
})

test("getSchema returns both variants for hybrid types", async () => {
	const provider = makeProvider()
	await provider.init("1.0.0")
	const s = await provider.getSchema("fake_thing")
	expect(s?.resource).toBeDefined()
	expect(s?.data).toBeDefined()
})

test("getSchema returns undefined for unknown type", async () => {
	const provider = makeProvider()
	await provider.init("1.0.0")
	expect(await provider.getSchema("fake_nope")).toBeUndefined()
})

test("getProviderConfigSchema returns the provider config block", async () => {
	const provider = makeProvider()
	await provider.init("1.0.0")
	const ps = await provider.getProviderConfigSchema()
	const fields = ps?.identity.fields ?? []
	expect(
		fields.find((field) => field.name.terraformName === "region"),
	).toBeDefined()
	expect(
		fields.find((field) => field.name.terraformName === "access_key"),
	).toMatchObject({ kind: "attribute", sensitive: true })
})

test("info reflects tfSource and current version across init calls", async () => {
	const provider = makeProvider()
	expect(provider.info).toEqual({ tfSource: "fakecorp/fake", version: null })
	await provider.init("1.0.0")
	expect(provider.info).toEqual({ tfSource: "fakecorp/fake", version: "1.0.0" })
	await provider.init("2.0.0")
	expect(provider.info).toEqual({ tfSource: "fakecorp/fake", version: "2.0.0" })
})
