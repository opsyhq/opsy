import type {
	BridgeClient,
	ResourceIdentitySchema,
	ResourceSchema,
} from "@opsy/bridge-client"
import { BridgeTransportError } from "@opsy/bridge-client"
import {
	type ProviderCapabilities,
	ProviderCapabilityError,
	type TypeCapabilities,
} from "./capabilities"
import { buildFieldTree, type ResourceTypeSchema } from "./field-tree"
import type { Integration, ProviderIntegrationDefinition } from "./integration"
import type {
	ProviderOp,
	ProviderOperationContext,
	ProviderResultByKind,
} from "./ops"
import type { Diagnostic, ProviderResult } from "./result"
import {
	type TfDispatchDeps,
	tfApply,
	tfImport,
	tfPlan,
	tfRead,
	tfReadData,
} from "./tf-backed"
import type {
	OpsyProvider,
	ProviderType,
	ProviderTypeSearchResult,
} from "./types"

type Kind = "resource" | "data"
type TypeSchemas = {
	resource?: ResourceTypeSchema
	data?: ResourceTypeSchema
}

interface ComposeOptions {
	name: string
	bridge: BridgeClient
	tfSource: string
	providerConfigFor: (integration: Integration) => Record<string, unknown>
	integrationDefinition?: ProviderIntegrationDefinition
}

interface BuiltEntry {
	type: ProviderType
}

export function composeProvider(opts: ComposeOptions): OpsyProvider {
	const entryCache = new Map<string, BuiltEntry>()
	const schemaCache = new Map<`${Kind}:${string}`, ResourceSchema | null>()
	let providerSchema: ResourceSchema | null | undefined
	let currentVersion: string | null = null
	let capabilities: ProviderCapabilities = {
		resourceCount: 0,
		dataSourceCount: 0,
	}

	function requireVersion(method: string): string {
		if (currentVersion === null) {
			throw new Error(
				`OpsyProvider(${opts.name}).${method}: called before init(). ` +
					`Await provider.init(version) before serving requests.`,
			)
		}
		return currentVersion
	}

	function providerRef() {
		return {
			provider_source: opts.tfSource,
			provider_version: requireVersion("providerRef"),
		}
	}

	async function resolveKinds(type: string): Promise<Kind[] | null> {
		try {
			const resolved = await opts.bridge.resolveType({
				...providerRef(),
				type,
			})
			return resolved.kinds.filter(
				(kind): kind is Kind => kind === "resource" || kind === "data",
			)
		} catch (err) {
			if (err instanceof BridgeTransportError && err.status === 400) {
				return null
			}
			throw err
		}
	}

	function buildEntry(type: string, kinds: Kind[]): BuiltEntry | undefined {
		const isResource = kinds.includes("resource")
		const isData = kinds.includes("data")
		if (!isResource && !isData) return undefined

		const caps: TypeCapabilities = {
			resource: isResource,
			data: isData,
		}

		return { type: { type, capabilities: caps } }
	}

	async function getOrBuildEntry(
		type: string,
	): Promise<BuiltEntry | undefined> {
		const cached = entryCache.get(type)
		if (cached !== undefined) return cached
		const kinds = await resolveKinds(type)
		if (kinds === null) return undefined
		const built = buildEntry(type, kinds)
		if (built !== undefined) entryCache.set(type, built)
		return built
	}

	async function fetchKindSchema(
		type: string,
		kind: Kind,
	): Promise<ResourceSchema | undefined> {
		const key = `${kind}:${type}` as const
		if (schemaCache.has(key)) return schemaCache.get(key) ?? undefined
		try {
			const resp = await opts.bridge.getTypeSchema({
				...providerRef(),
				type,
				kind,
			})
			schemaCache.set(key, resp.schema ?? null)
			return resp.schema
		} catch (err) {
			if (err instanceof BridgeTransportError && err.status === 400) {
				schemaCache.set(key, null)
				return undefined
			}
			throw err
		}
	}

	function ensureResourceOp(entry: BuiltEntry | undefined, type: string): void {
		if (!entry) {
			throw new ProviderCapabilityError(
				`unknown resource type: ${opts.name}/${type}`,
				"unknown_type",
			)
		}
		if (!entry.type.capabilities.resource) {
			throw new ProviderCapabilityError(
				`${opts.name}/${type} is a data source, not a managed resource`,
			)
		}
	}

	function ensureDataOp(entry: BuiltEntry | undefined, type: string): void {
		if (!entry) {
			throw new ProviderCapabilityError(
				`unknown type: ${opts.name}/${type}`,
				"unknown_type",
			)
		}
		if (!entry.type.capabilities.data) {
			throw new ProviderCapabilityError(
				`${opts.name}/${type} is not a data source; use a managed resource op instead`,
			)
		}
	}

	const tfDeps = (): TfDispatchDeps => ({
		bridge: opts.bridge,
		tfSource: opts.tfSource,
		version: requireVersion("dispatch"),
		providerConfigFor: opts.providerConfigFor,
	})

	async function dispatch<Op extends ProviderOp>(
		op: Op,
		ctx: ProviderOperationContext,
	): Promise<ProviderResult<Op["kind"]>> {
		requireVersion("dispatch")
		const entry = await getOrBuildEntry(op.type)
		if (op.kind === "ReadData") {
			ensureDataOp(entry, op.type)
		} else {
			ensureResourceOp(entry, op.type)
		}

		const diagnostics: Diagnostic[] = []
		const ok = <K extends Op["kind"]>(
			kind: K,
			payload: ProviderResultByKind[K],
		): ProviderResult<Op["kind"]> => ({
			kind,
			payload: payload as ProviderResultByKind[Op["kind"]],
			diagnostics,
		})

		switch (op.kind) {
			case "Plan": {
				const payload = await tfPlan(tfDeps(), op, ctx.integration, ctx.signal)
				return ok("Plan", payload)
			}
			case "Apply": {
				const payload = await tfApply(tfDeps(), op, ctx.integration, ctx.signal)
				return ok("Apply", payload)
			}
			case "Read": {
				const payload = await tfRead(tfDeps(), op, ctx.integration, ctx.signal)
				return ok("Read", payload)
			}
			case "Import": {
				const payload = await tfImport(
					tfDeps(),
					op,
					ctx.integration,
					ctx.signal,
				)
				return ok("Import", payload)
			}
			case "ReadData": {
				const payload = await tfReadData(
					tfDeps(),
					op,
					ctx.integration,
					ctx.signal,
				)
				return ok("ReadData", payload)
			}
			default: {
				const _exhaustive: never = op
				void _exhaustive
				throw new Error(`unhandled op kind: ${(op as ProviderOp).kind}`)
			}
		}
	}

	function getSchema(
		type: string,
		kind: Kind,
	): Promise<ResourceTypeSchema | undefined>
	function getSchema(type: string): Promise<TypeSchemas | undefined>
	async function getSchema(
		type: string,
		kind?: Kind,
	): Promise<ResourceTypeSchema | TypeSchemas | undefined> {
		requireVersion("getSchema")
		// Raw cty `ResourceSchema` is consumed only here, at the semantic
		// boundary: `buildFieldTree` is the single place the wire shape becomes
		// the normalized `Field[]` model. Nothing downstream sees `.block`.
		if (kind) {
			const raw = await fetchKindSchema(type, kind)
			return raw ? buildFieldTree(raw) : undefined
		}
		const kinds = await resolveKinds(type)
		if (kinds === null) return undefined
		const out: TypeSchemas = {}
		await Promise.all(
			kinds.map(async (resolvedKind) => {
				const raw = await fetchKindSchema(type, resolvedKind)
				if (raw) out[resolvedKind] = buildFieldTree(raw)
			}),
		)
		return Object.keys(out).length === 0 ? undefined : out
	}

	const provider: OpsyProvider = {
		name: opts.name,

		get info(): { tfSource: string; version: string | null } {
			return { tfSource: opts.tfSource, version: currentVersion }
		},

		get capabilities(): ProviderCapabilities {
			return capabilities
		},

		get integrationDefinition(): ProviderIntegrationDefinition | undefined {
			return opts.integrationDefinition
		},

		async init(version: string): Promise<void> {
			if (currentVersion === version) return
			if (currentVersion !== null && currentVersion !== version) {
				console.warn(
					`OpsyProvider(${opts.name}).init: re-initializing at version ${version} ` +
						`(was ${currentVersion}); clearing selected schema caches`,
				)
				entryCache.clear()
				schemaCache.clear()
				providerSchema = undefined
			}
			const summary = await opts.bridge.getSummary({
				provider_source: opts.tfSource,
				provider_version: version,
			})
			currentVersion = version
			capabilities = {
				resourceCount: summary.resource_count,
				dataSourceCount: summary.data_source_count,
			}
		},

		async getType(type: string): Promise<ProviderType | undefined> {
			requireVersion("getType")
			return (await getOrBuildEntry(type))?.type
		},

		async getTypeIdentity(
			type: string,
		): Promise<ResourceIdentitySchema | null | undefined> {
			requireVersion("getTypeIdentity")
			try {
				const resp = await opts.bridge.getTypeIdentity({
					...providerRef(),
					type,
				})
				return resp.identity ?? null
			} catch (err) {
				if (err instanceof BridgeTransportError && err.status === 400) {
					return undefined
				}
				throw err
			}
		},

		async searchTypes(input): Promise<{
			results: ProviderTypeSearchResult[]
			truncated: boolean
		}> {
			requireVersion("searchTypes")
			const resp = await opts.bridge.searchTypes({
				...providerRef(),
				q: input.q,
				kind: input.kind ?? "both",
				limit: input.limit,
				offset: input.offset,
			})
			return {
				results: resp.results.map((result) => ({
					type: result.type,
					kinds: result.kinds.filter(
						(kind): kind is Kind => kind === "resource" || kind === "data",
					),
				})),
				truncated: resp.truncated,
			}
		},

		getSchema,

		async getProviderConfigSchema(): Promise<
			ResourceTypeSchema | undefined
		> {
			requireVersion("getProviderConfigSchema")
			if (providerSchema === undefined) {
				const resp = await opts.bridge.getProviderConfigSchema(providerRef())
				providerSchema = resp.schema ?? null
			}
			return providerSchema ? buildFieldTree(providerSchema) : undefined
		},

		async checkIntegration(integration: Integration, signal?: AbortSignal) {
			requireVersion("checkIntegration")
			try {
				const resp = await opts.bridge.validateProvider(
					{
						...providerRef(),
						provider_config: opts.providerConfigFor(integration),
					},
					{ signal },
				)
				const diagnostics = resp.diagnostics ?? []
				return {
					status: diagnostics.some(
						(diagnostic) => diagnostic.severity === "error",
					)
						? "invalid"
						: "valid",
					checkedAt: new Date().toISOString(),
					diagnostics,
				}
			} catch (err) {
				return {
					status: "unknown",
					checkedAt: new Date().toISOString(),
					diagnostics: [
						{
							severity: "error",
							summary: "Connection check failed",
							detail: err instanceof Error ? err.message : String(err),
						},
					],
				}
			}
		},

		dispatch,
	}

	return provider
}
