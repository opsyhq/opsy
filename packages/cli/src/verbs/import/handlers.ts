import { apiError, CliError } from "@core/errors"
import type { HandlerDeps } from "@core/types/deps"
import type { ApprovalFlagOpts } from "@shell/approval"
import { reportStaged } from "@shell/changeset"
import { resolveProject } from "@shell/project"
import { fetchImportIdentity, inferProvider } from "@shell/providers"
import {
	renderOperation,
	renderResource,
	runMutationOperation,
} from "@shell/render"
import type { InferRequestType } from "hono/client"
import type { client } from "../../client"

type ImportBody = InferRequestType<
	(typeof client.projects)[":project"]["resources"]["import"]["$post"]
>["json"]

export interface ImportOpts extends ApprovalFlagOpts {
	project?: string
	type: string
	providerId?: string
	identity: string[]
	format?: string
	stage?: boolean
	integration?: string
}

// An import is import-id mode XOR identity mode. Identity attribute values
// stay raw strings — the bridge owns coercion to each attribute's wire type
// from the cached identity schema, so the CLI must not pre-parse them.
function importHandle(
	opts: ImportOpts,
): Pick<ImportBody, "providerId" | "identity"> {
	const identity: Record<string, string> = {}
	for (const pair of opts.identity) {
		const eq = pair.indexOf("=")
		const key = eq === -1 ? "" : pair.slice(0, eq).trim()
		if (eq === -1 || !key) {
			throw new CliError(
				`invalid --identity "${pair}"`,
				"INVALID_IDENTITY",
				"pass --identity key=value (repeat for each attribute)",
			)
		}
		identity[key] = pair.slice(eq + 1)
	}
	const hasIdentity = Object.keys(identity).length > 0
	if ((opts.providerId !== undefined) === hasIdentity) {
		throw new CliError(
			"provide exactly one of --provider-id or --identity",
			"CONFLICTING_FLAGS",
			"use --provider-id <id> for a raw import id, or one or more --identity key=value",
		)
	}
	return hasIdentity ? { identity } : { providerId: opts.providerId }
}

// Reactive, best-effort: when an import fails, ask the provider what the type
// actually needs (the same contract the web form reads — never pre-checked
// here) and rephrase the failure into a runnable retry. Any failure resolving
// the hint yields the original error untouched, so this never masks the real
// cause — the provider's own diagnostic is still rendered above it.
async function enrichImportError(
	deps: HandlerDeps,
	slug: string,
	type: string,
	err: unknown,
): Promise<unknown> {
	try {
		const identity = await fetchImportIdentity(
			deps,
			await inferProvider(deps, type),
			type,
		)
		if (identity?.mode === "identity") {
			const attrs = identity.identity.attributes
			const required = attrs.filter((a) => a.required_for_import)
			const optional = attrs.filter((a) => !a.required_for_import)
			const lines = [
				`import ${type} needs structured identity`,
				...required.map(
					(a) =>
						`  required: ${a.name} (${typeof a.type === "string" ? a.type : "string"})${
							a.description ? ` — ${a.description}` : ""
						}`,
				),
				...(optional.length
					? [`  optional: ${optional.map((a) => a.name).join(", ")}`]
					: []),
			]
			const flags = [
				...required.map((a) => `--identity ${a.name}=<${a.name}>`),
				...optional.map((a) => `[--identity ${a.name}=<…>]`),
			].join(" ")
			return new CliError(
				lines.join("\n"),
				"IMPORT_IDENTITY_REQUIRED",
				`retry: opsy resource import ${slug} --type ${type} ${flags}`,
			)
		}
		if (identity?.mode === "import-id") {
			return new CliError(
				`import ${type} uses a raw provider id (no structured identity)`,
				"IMPORT_ID_REQUIRED",
				`retry: opsy resource import ${slug} --type ${type} --provider-id <id>`,
			)
		}
	} catch {
		// best-effort: hint resolution must never mask the real failure
	}
	return err
}

export async function importResource(
	deps: HandlerDeps,
	slug: string,
	opts: ImportOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	try {
		const body: ImportBody = {
			slug,
			type: opts.type,
			...importHandle(opts),
			...(opts.integration ? { integrationSlug: opts.integration } : {}),
		}
		if (opts.stage) {
			await reportStaged(
				deps,
				project,
				{
					kind: "import_resource",
					source: "user",
					changes: body as Record<string, unknown>,
				},
				opts,
				`staged import ${slug}`,
			)
			return
		}
		const res = await deps.client.projects[":project"].resources.import.$post({
			param: { project },
			json: body,
		})
		if (!res.ok) throw apiError(res.status, await res.text())
		await runMutationOperation(deps, await res.json(), opts, (data) => {
			deps.output.section("result")
			renderOperation(deps, data.operation)
			if (data.resource) renderResource(deps, data.resource)
		})
	} catch (err) {
		throw await enrichImportError(deps, slug, opts.type, err)
	}
}
