import { apiError } from "@core/errors"
import { getProperty } from "@core/inputs/dot-path"
import { isJsonOutput } from "@core/output/output-format"
import { resourceStatus } from "@core/render/resource"
import type { HandlerDeps } from "@core/types/deps"
import { InvalidInput } from "@opsy/contracts/errors"
import { formatApprovalPolicy } from "@shell/policy"
import { resolveProject } from "@shell/project"
import { renderResource } from "@shell/render"
import type { InferRequestType, InferResponseType } from "hono/client"
import type { client } from "../../client"

type TypesSearchQuery = InferRequestType<
	(typeof client.providers)[":provider"]["types"]["$get"]
>["query"]
type TypesResponse = InferResponseType<
	(typeof client.providers)[":provider"]["types"]["$get"],
	200
>

type OperationsQuery = InferRequestType<
	(typeof client.projects)[":project"]["operations"]["$get"]
>["query"]

export interface GetOpts {
	project?: string
	resource?: string
	kind?: string
	status?: string
	includeSystem?: boolean
	provider?: string
	search?: string
	limit?: string
	offset?: string
	all?: boolean
	output?: string
	format?: string
}

export async function getResource(
	deps: HandlerDeps,
	name: string,
	opts: GetOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const res = await deps.client.projects[":project"].resources[":slug"].$get({
		param: { project, slug: name },
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	const data = await res.json()
	if (opts.output) {
		// Direct accessor: emit one raw value for scripting. A genuine miss is
		// bad user input → InvalidInput (HTTP 400 → exit 5 via the taxonomy),
		// not an empty line that a pipeline would silently swallow.
		const hit = getProperty(data, opts.output)
		if (!hit.found) {
			throw new InvalidInput({ detail: `no value at path "${opts.output}"` })
		}
		deps.output.log(
			typeof hit.value === "string"
				? hit.value
				: JSON.stringify(hit.value ?? null, null, 2),
		)
		return
	}
	if (isJsonOutput(opts)) {
		// Same `{ resource }` envelope as `describe` — one entity, one shape.
		deps.output.printJson({ resource: data })
		return
	}
	renderResource(deps, data)
	const inputs = data.inputs as Record<string, unknown> | null
	if (inputs && Object.keys(inputs).length > 0) {
		deps.output.section("values")
		deps.output.log(JSON.stringify(inputs, null, 2))
	}
}

export async function listResources(
	deps: HandlerDeps,
	opts: GetOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const res = await deps.client.projects[":project"].resources.$get({
		param: { project },
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	const data = await res.json()
	if (isJsonOutput(opts)) {
		deps.output.printJson(data)
		return
	}
	if (!data.resources.length) {
		deps.output.note("no resources")
		return
	}
	deps.output.table(
		data.resources.map((r) => ({
			slug: r.slug,
			type: r.type,
			status: resourceStatus(r),
		})),
	)
}

export async function getProject(
	deps: HandlerDeps,
	name: string,
	opts: GetOpts,
): Promise<void> {
	const res = await deps.client.projects[":project"].$get({
		param: { project: name },
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	const { project } = await res.json()
	if (isJsonOutput(opts)) {
		deps.output.printJson({ project })
		return
	}
	deps.output.keyValue([
		["id", project.id],
		["slug", project.slug],
		["org id", project.orgId],
		["approval policy", formatApprovalPolicy(project.approvalPolicy)],
		["scan interval", project.scanInterval],
		["created", project.createdAt],
		["updated", project.updatedAt],
	])
}

export async function listProjects(
	deps: HandlerDeps,
	opts: GetOpts,
): Promise<void> {
	const res = await deps.client.projects.$get()
	if (!res.ok) throw apiError(res.status, await res.text())
	const { projects } = await res.json()
	if (isJsonOutput(opts)) {
		deps.output.printJson({ projects })
		return
	}
	if (projects.length === 0) {
		deps.output.note("(no projects)")
		return
	}
	deps.output.table(projects, ["slug", "createdAt"])
}

export async function listIntegrations(
	deps: HandlerDeps,
	opts: GetOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const res = await deps.client.projects[":project"].integrations.$get({
		param: { project },
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	const { integrations } = await res.json()
	if (isJsonOutput(opts)) {
		deps.output.printJson({ integrations })
		return
	}
	if (integrations.length === 0) {
		deps.output.note("(no integrations)")
		return
	}
	deps.output.table(
		integrations.map((i) => ({
			provider: i.provider,
			slug: i.slug,
			name: i.name ?? i.slug,
			default: i.isDefault ? "✓" : "",
			id: i.id,
		})),
		["provider", "slug", "name", "default", "id"],
	)
}

export async function getOperation(
	deps: HandlerDeps,
	id: string,
	opts: GetOpts,
): Promise<void> {
	const res = await deps.client.operations[":id"].$get({ param: { id } })
	if (!res.ok) throw apiError(res.status, await res.text())
	const data = await res.json()
	if (isJsonOutput(opts)) {
		deps.output.printJson(data)
		return
	}
	deps.output.keyValue([
		["operation", data.operation.id],
		["kind", data.operation.kind],
		["status", data.operation.status],
		["resource", data.operation.resourceId ?? ""],
		["created", data.operation.createdAt],
	])
}

export async function listOperations(
	deps: HandlerDeps,
	opts: GetOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const query: OperationsQuery = {
		...(opts.kind ? { kind: opts.kind as OperationsQuery["kind"] } : {}),
		...(opts.status
			? { status: opts.status as OperationsQuery["status"] }
			: {}),
		...(opts.resource ? { resourceSlug: opts.resource } : {}),
		...(opts.includeSystem ? { includeSystem: "true" } : {}),
		...(opts.limit ? { limit: opts.limit as OperationsQuery["limit"] } : {}),
	}
	const res = await deps.client.projects[":project"].operations.$get({
		param: { project },
		query,
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	const data = await res.json()
	if (isJsonOutput(opts)) {
		deps.output.printJson(data)
		return
	}
	if (!data.operations.length) {
		deps.output.note("no operations")
		return
	}
	for (const a of data.operations) {
		deps.output.keyValue([
			["id", a.id],
			["kind", a.kind],
			["status", a.status],
			["resource", a.resourceId ?? ""],
			["created", a.createdAt],
		] satisfies Array<[string, unknown]>)
	}
}

export async function listProviders(
	deps: HandlerDeps,
	opts: GetOpts,
): Promise<void> {
	const res = await deps.client.providers.$get()
	if (!res.ok) throw apiError(res.status, await res.text())
	const data = await res.json()
	if (isJsonOutput(opts)) {
		deps.output.printJson(data)
		return
	}
	if (data.providers.length === 0) {
		deps.output.note("no providers registered")
		return
	}
	deps.output.table(
		data.providers.map((p) => ({
			name: p.name,
			source: p.source,
			version: p.version ?? "(uninitialized)",
			resources: p.resourceCount,
			"data sources": p.dataSourceCount,
		})),
	)
}

export async function listTypes(
	deps: HandlerDeps,
	opts: GetOpts,
): Promise<void> {
	if (!opts.provider) {
		throw new InvalidInput({
			detail:
				"--provider is required — pass --provider <name>, e.g. --provider aws",
		})
	}
	const provider = opts.provider
	// The server's `searchTypesQuery` (.coerce.number().int().min(1).max(100))
	// is the single owner of the limit bound — no parallel CLI guard to drift
	// from it. The CLI only picks a soft default page size; out-of-range or
	// non-numeric values surface the server's own validation message.
	const pageSize = opts.limit ?? (opts.search ? "20" : "50")
	const baseQuery =
		opts.search && opts.search.length > 0 ? { q: opts.search } : {}

	const fetchPage = async (offset: number): Promise<TypesResponse> => {
		// `searchTypesQuery` is `z.coerce.number()` on the server; the hono
		// client types the input as the coerced `number`, so widen once here
		// rather than scattering casts.
		const query = {
			...baseQuery,
			limit: pageSize,
			offset: String(offset),
		} as unknown as TypesSearchQuery
		const res = await deps.client.providers[":provider"].types.$get({
			param: { provider },
			query,
		})
		if (!res.ok) throw apiError(res.status, await res.text())
		return res.json()
	}

	// `truncated` means "more rows past offset+limit". Walk by the count
	// actually returned (the correct offset-cursor move; a short page means we
	// hit the end), and stop on an empty page so a misbehaving provider that
	// flags truncation forever can't spin.
	const drain = async (
		offset: number,
		acc: TypesResponse["results"],
	): Promise<TypesResponse["results"]> => {
		const page = await fetchPage(offset)
		const next = [...acc, ...page.results]
		return page.truncated && page.results.length > 0
			? drain(offset + page.results.length, next)
			: next
	}

	const data: TypesResponse = opts.all
		? { results: await drain(0, []), truncated: false }
		: await fetchPage(Number(opts.offset ?? "0"))

	if (isJsonOutput(opts)) {
		// `artifacts` is icon/display metadata for the web — pure noise for a
		// machine consuming the catalog. Keep the contract to {results,truncated}
		// with each hit reduced to its identifying fields.
		deps.output.printJson({
			results: data.results.map(({ artifacts: _artifacts, ...hit }) => hit),
			truncated: data.truncated,
		})
		return
	}
	if (data.results.length === 0) {
		deps.output.note(opts.search ? "no matches" : "no types")
		return
	}
	deps.output.table(
		data.results.map((r) => ({
			name: r.type,
			summary: r.kinds.join(", "),
		})),
		["name", "summary"],
	)
	if (data.truncated) {
		deps.output.note(
			opts.search
				? "results truncated — narrow the query, or page with --offset/--all"
				: "results truncated — page with --offset/--all, or filter with --search",
		)
	}
}

export async function getIntegration(
	deps: HandlerDeps,
	slug: string,
	opts: GetOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const res = await deps.client.projects[":project"].integrations[":slug"].$get(
		{ param: { project, slug } },
	)
	if (!res.ok) throw apiError(res.status, await res.text())
	const { integration } = await res.json()
	if (isJsonOutput(opts)) {
		deps.output.printJson({ integration })
		return
	}
	deps.output.keyValue([
		["id", integration.id],
		["provider", integration.provider],
		["version", integration.providerVersion ?? "default"],
		["slug", integration.slug],
		["name", integration.name ?? integration.slug],
		["default", integration.isDefault],
		["created", integration.createdAt],
	])
}

export interface RegistryConnectOpts {
	mode?: string
	providerVersion?: string
	format?: string
}

// Build the `credentials` skeleton for `integration create` from the schema
// itself: discriminator set to the chosen source, every other required field
// of the matching union branch left blank, and any field listed in
// `createGeneratedFieldsByMode` (e.g. AWS assume_role external_id) minted
// here. Provider-driven — no hardcoded field names.
function credentialSkeleton(
	credentialsSchema: Record<string, unknown> | null,
	discriminator: string | null,
	mode: string,
	generated: Record<string, { kind: "uuid" }> | null,
	mintUuid: () => string,
): Record<string, unknown> {
	const skeleton: Record<string, unknown> = {}
	if (discriminator) skeleton[discriminator] = mode
	const branches = (credentialsSchema?.anyOf ?? credentialsSchema?.oneOf) as
		| Array<Record<string, unknown>>
		| undefined
	const matches = (branch: Record<string, unknown>): boolean => {
		if (!discriminator) return false
		const props = branch.properties as
			| Record<string, Record<string, unknown>>
			| undefined
		const disc = props?.[discriminator]
		if (!disc) return false
		if (disc.const === mode) return true
		return Array.isArray(disc.enum) && disc.enum.includes(mode)
	}
	const branch = branches?.find(matches) ?? credentialsSchema
	const required = branch?.required
	if (Array.isArray(required)) {
		for (const field of required) {
			if (typeof field !== "string") continue
			if (field === discriminator || field in skeleton) continue
			skeleton[field] = ""
		}
	}
	if (generated) {
		for (const [field, spec] of Object.entries(generated)) {
			if (spec.kind === "uuid") skeleton[field] = mintUuid()
		}
	}
	return skeleton
}

// Non-idempotent: mints a fresh external id per call. Mirrors the web form's
// onboarding-driven external id generation (IntegrationForm.tsx).
export async function registryConnect(
	deps: HandlerDeps,
	provider: string,
	opts: RegistryConnectOpts,
): Promise<void> {
	const schemaRes = await deps.client.providers[":provider"][
		"integration-schema"
	].$get({
		param: { provider },
		query: opts.providerVersion
			? { providerVersion: opts.providerVersion }
			: {},
	})
	if (!schemaRes.ok) throw apiError(schemaRes.status, await schemaRes.text())
	const schema = await schemaRes.json()
	const credentialForm = schema.credentialForm
	const discriminator = schema.credentialDiscriminator
	const onboarding = schema.onboarding

	const mode = opts.mode ?? credentialForm?.preferredMode
	if (!mode) {
		throw new InvalidInput({
			detail: `provider "${provider}" advertises no credential modes — nothing to set up`,
		})
	}

	// Build the skeleton first — it mints any generated fields for the chosen
	// mode (e.g. AWS assume_role.external_id), so the same value flows into
	// the onboarding render below without a second source of randomness.
	const generated = credentialForm?.createGeneratedFieldsByMode?.[mode] ?? null
	const credentials = credentialSkeleton(
		schema.credentials,
		discriminator,
		mode,
		generated,
		deps.randomUUID,
	)

	// Onboarding artifacts (e.g. AWS assume-role trust policy) render against
	// the same external_id the credentials skeleton carries. Only fire when
	// the chosen mode is the one that actually generates an external id —
	// otherwise there's nothing to display.
	let onboardingArtifacts: {
		principalArn: string | null
		externalId: string
		document: string | null
		permissionsPolicyArn: string | null
		cloudformation: { launchUrl: string } | null
	} | null = null
	const onboardingExternalId =
		onboarding && typeof credentials[onboarding.externalIdField] === "string"
			? (credentials[onboarding.externalIdField] as string)
			: ""
	if (onboarding && onboardingExternalId) {
		const obRes = await deps.client.providers[":provider"].onboarding[
			":onboardingKind"
		].$get({
			param: { provider, onboardingKind: onboarding.kind },
			query: {
				external_id: onboardingExternalId,
				...(opts.providerVersion
					? { providerVersion: opts.providerVersion }
					: {}),
			},
		})
		if (!obRes.ok) throw apiError(obRes.status, await obRes.text())
		onboardingArtifacts = await obRes.json()
	}

	if (isJsonOutput(opts)) {
		deps.output.printJson({
			provider: schema.provider,
			providerVersion: schema.providerVersion,
			mode,
			credentialsSchema: schema.credentials,
			configSchema: schema.config,
			onboarding: onboardingArtifacts,
			credentials,
		})
		return
	}

	deps.output.keyValue([
		["provider", schema.provider],
		["source", schema.providerSource],
		["version", schema.providerVersion],
		["mode", mode],
		["discriminator", discriminator ?? ""],
	])
	deps.output.section("credentials schema")
	deps.output.log(JSON.stringify(schema.credentials, null, 2))
	deps.output.section("config schema")
	deps.output.log(JSON.stringify(schema.config, null, 2))
	if (onboardingArtifacts) {
		deps.output.section("onboarding")
		deps.output.log(JSON.stringify(onboardingArtifacts, null, 2))
	}
	deps.output.section("credentials skeleton")
	deps.output.dim(
		"→ fill in the blanks, then `opsy integration create <slug> --provider " +
			provider +
			" --credentials @<file>`",
	)
	deps.output.log(JSON.stringify(credentials, null, 2))
}
