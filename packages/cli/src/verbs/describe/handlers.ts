import { apiError } from "@core/errors"
import { isJsonOutput } from "@core/output/output-format"
import type { HandlerDeps } from "@core/types/deps"
import { formatApprovalPolicy } from "@shell/policy"
import { resolveProject } from "@shell/project"
import { renderOperation, renderResource } from "@shell/render"

export interface DescribeOpts {
	project?: string
	format?: string
	// Focused escape hatch: emit only the raw live-state snapshot and stop,
	// skipping the secondary inputs section. Outputs always lead regardless.
	outputs?: boolean
}

const isRefNode = (v: unknown): v is { $ref: string } =>
	typeof v === "object" &&
	v !== null &&
	!Array.isArray(v) &&
	typeof (v as { $ref?: unknown }).$ref === "string"

// Zip the declared `inputs` (carrying `{$ref}` nodes) against the
// server-resolved `inlinedInputs`, rendering each ref as
// `<resolved> (slug.path)` so the reader sees the concrete value without
// losing the reference's provenance. The server owns resolution — this only
// pairs the two structures it already returned.
function annotateRefs(raw: unknown, resolved: unknown): unknown {
	if (isRefNode(raw)) {
		const scalar =
			resolved !== null && typeof resolved === "object"
				? JSON.stringify(resolved)
				: String(resolved)
		return `${scalar} (${raw.$ref})`
	}
	if (Array.isArray(raw)) {
		const r = Array.isArray(resolved) ? resolved : []
		return raw.map((v, i) => annotateRefs(v, r[i]))
	}
	if (raw !== null && typeof raw === "object") {
		const r = (resolved ?? {}) as Record<string, unknown>
		return Object.fromEntries(
			Object.entries(raw as Record<string, unknown>).map(([k, v]) => [
				k,
				annotateRefs(v, r[k]),
			]),
		)
	}
	return raw
}

export async function describeResource(
	deps: HandlerDeps,
	slug: string,
	opts: DescribeOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const rRes = await deps.client.projects[":project"].resources[":slug"].$get({
		param: { project, slug },
	})
	if (!rRes.ok) throw apiError(rRes.status, await rRes.text())
	const resource = await rRes.json()

	if (isJsonOutput(opts)) {
		deps.output.printJson({ resource })
		return
	}
	renderResource(deps, resource)
	const outputs = resource.outputs as Record<string, unknown> | null
	const inputs = resource.inputs as Record<string, unknown> | null

	// Lead with the computed outputs — the live state is what callers act on;
	// "no live state yet" when the resource has never been applied.
	deps.output.section("outputs")
	if (outputs && Object.keys(outputs).length > 0) {
		deps.output.log(JSON.stringify(outputs, null, 2))
	} else {
		deps.output.note("no live state yet")
	}

	// `--outputs` stops here (raw snapshot only). Otherwise the declared
	// inputs follow as secondary context, with any `$ref`s shown resolved
	// (the server attaches `inlinedInputs` only when it substituted some).
	if (!opts.outputs && inputs && Object.keys(inputs).length > 0) {
		const inlined = resource.inlinedInputs
		deps.output.section("inputs")
		deps.output.log(
			JSON.stringify(
				inlined !== undefined ? annotateRefs(inputs, inlined) : inputs,
				null,
				2,
			),
		)
	}
}

export async function describeProject(
	deps: HandlerDeps,
	slug: string,
	opts: DescribeOpts,
): Promise<void> {
	const [pRes, iRes] = await Promise.all([
		deps.client.projects[":project"].$get({ param: { project: slug } }),
		deps.client.projects[":project"].integrations.$get({
			param: { project: slug },
		}),
	])
	if (!pRes.ok) throw apiError(pRes.status, await pRes.text())
	const { project } = await pRes.json()
	const { integrations } = iRes.ok ? await iRes.json() : { integrations: [] }

	if (isJsonOutput(opts)) {
		deps.output.printJson({ project, integrations })
		return
	}
	deps.output.keyValue([
		["id", project.id],
		["slug", project.slug],
		["org id", project.orgId],
		["approval policy", formatApprovalPolicy(project.approvalPolicy)],
		["created", project.createdAt],
		["updated", project.updatedAt],
	])
	deps.output.section("integrations")
	if (!integrations.length) {
		deps.output.note("none")
		return
	}
	deps.output.table(
		integrations.map((i) => ({
			slug: i.slug,
			provider: i.provider,
			name: i.name ?? i.slug,
			default: i.isDefault ? "✓" : "",
			id: i.id,
		})),
		["slug", "provider", "name", "default", "id"],
	)
}

export async function describeOperation(
	deps: HandlerDeps,
	id: string,
	opts: DescribeOpts,
): Promise<void> {
	const res = await deps.client.operations[":id"].$get({ param: { id } })
	if (!res.ok) throw apiError(res.status, await res.text())
	const data = await res.json()
	if (isJsonOutput(opts)) {
		deps.output.printJson(data)
		return
	}
	renderOperation(deps, data.operation)
}
