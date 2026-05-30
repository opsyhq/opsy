import { apiError, CliError } from "@core/errors"
import { isJsonOutput } from "@core/output/output-format"
import type { HandlerDeps } from "@core/types/deps"
import type { ApprovalFlagOpts } from "@shell/approval"
import { reportStaged } from "@shell/changeset"
import { resolveProject } from "@shell/project"
import {
	type DryRunOpts,
	readJsonFlag,
	renderDryRun,
	renderOperation,
	renderResource,
	resolveInputs,
	runMutationOperation,
} from "@shell/render"
import type { InferRequestType } from "hono/client"
import type { client } from "../../client"

type ResourceCreateBody = InferRequestType<
	(typeof client.projects)[":project"]["resources"]["$post"]
>["json"]

export interface CreateOpts extends ApprovalFlagOpts, DryRunOpts {
	project?: string
	type?: string
	slug?: string
	values?: string
	set: string[]
	setJson: string[]
	setRef: string[]
	unset: string[]
	provider?: string
	providerVersion?: string
	credentials?: string
	config?: string
	name?: string
	driver?: string
	default?: boolean
	format?: string
	stage?: boolean
	integration?: string
}

interface CreateResourceOpts extends CreateOpts {
	type: string
}
interface CreateIntegrationOpts extends CreateOpts {
	provider: string
	providerVersion?: string
}

async function assertKnownType(deps: HandlerDeps, type: string): Promise<void> {
	const idx = type.indexOf("_")
	if (idx <= 0) {
		throw new CliError(
			`type "${type}" is missing a provider prefix — expected <provider>_<resource> (e.g. aws_s3_bucket)`,
			"INVALID_FLAGS",
		)
	}
	const provider = type.slice(0, idx)
	const res = await deps.client.providers[":provider"].types[
		":type"
	].identity.$get({
		param: { provider, type },
	})
	if (res.status === 400 || res.status === 404) {
		throw new CliError(
			`unknown resource type "${type}" — run \`opsy registry types ${provider}\` to see available types`,
			"INVALID_FLAGS",
		)
	}
}

export async function createResource(
	deps: HandlerDeps,
	slug: string,
	opts: CreateResourceOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	await assertKnownType(deps, opts.type)
	// Data sources are no longer created here — one-shot lookups have their own
	// `query` verb (POST /data/query). `create resource` is provider-backed only.
	const body: ResourceCreateBody = {
		slug,
		type: opts.type,
		inputs: resolveInputs(deps.fs, opts),
		...(opts.integration ? { integrationSlug: opts.integration } : {}),
	}
	if (opts.stage) {
		await reportStaged(
			deps,
			project,
			{
				kind: "create_resource",
				source: "user",
				changes: body as Record<string, unknown>,
			},
			opts,
			`staged create ${slug}`,
		)
		return
	}
	if (opts.dryRun) {
		const planRes = await deps.client.projects[":project"].resources[
			"dry-run"
		].$post({
			param: { project },
			json: body,
		})
		if (!planRes.ok) throw apiError(planRes.status, await planRes.text())
		const { dryRun } = await planRes.json()
		renderDryRun(deps, dryRun, opts)
		return
	}
	const res = await deps.client.projects[":project"].resources.$post({
		param: { project },
		json: body,
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	const raw = await res.json()
	await runMutationOperation(deps, raw, opts, (data) => {
		deps.output.section("result")
		renderOperation(deps, data.operation)
		if (data.resource) renderResource(deps, data.resource)
	})
}

export async function createProject(
	deps: HandlerDeps,
	slug: string,
	opts: CreateOpts,
): Promise<void> {
	const res = await deps.client.projects.$post({ json: { slug } })
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
		["created", project.createdAt],
	])
}

export async function createIntegration(
	deps: HandlerDeps,
	slug: string,
	opts: CreateIntegrationOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	if (opts.providerVersion) {
		const providersRes = await deps.client.providers.$get()
		if (!providersRes.ok)
			throw apiError(providersRes.status, await providersRes.text())
		const { providers } = (await providersRes.json()) as {
			providers: Array<{
				name: string
				versions?: string[]
				version?: string | null
			}>
		}
		const provider = providers.find((p) => p.name === opts.provider)
		const versions =
			provider?.versions ?? (provider?.version ? [provider.version] : [])
		if (!provider || !versions.includes(opts.providerVersion)) {
			throw new CliError(
				`provider version "${opts.providerVersion}" is not allowed for ${opts.provider}`,
				"INVALID_FLAGS",
				versions.length > 0
					? `allowed versions: ${versions.join(", ")}`
					: "run `opsy registry list` to see available providers",
			)
		}
	}
	const credentials =
		opts.credentials !== undefined
			? readJsonFlag(deps.fs, opts.credentials, "--credentials")
			: {}
	const config =
		opts.config !== undefined
			? readJsonFlag(deps.fs, opts.config, "--config")
			: {}
	const res = await deps.client.projects[":project"].integrations.$post({
		param: { project },
		json: {
			provider: opts.provider,
			...(opts.providerVersion
				? { providerVersion: opts.providerVersion }
				: {}),
			slug,
			...(opts.name ? { name: opts.name } : {}),
			...(opts.default ? { default: true } : {}),
			credentials,
			config,
		},
	})
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
