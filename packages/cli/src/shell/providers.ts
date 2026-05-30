import { apiError, CliError } from "@core/errors"
import type { HandlerDeps } from "@core/types/deps"
import type { InferResponseType } from "hono/client"
import type { client } from "../client"

// The structured-identity-vs-raw-ID contract is owned by the provider and
// served by one endpoint — the same one the web import form reads. Never
// re-declared here.
export type ImportIdentity = InferResponseType<
	(typeof client.providers)[":provider"]["types"][":type"]["identity"]["$get"],
	200
>

// Terraform convention: a type token is `<provider>_<rest>`. Resolving the
// provider by prefix-matching the registered providers is the one rule both
// `explain` and import-hint discovery rely on — kept here so it can't drift.
export async function inferProvider(
	deps: HandlerDeps,
	type: string,
): Promise<string> {
	const res = await deps.client.providers.$get()
	if (!res.ok) throw apiError(res.status, await res.text())
	const data = (await res.json()) as { providers: Array<{ name: string }> }
	const matches = data.providers.filter((p) => type.startsWith(`${p.name}_`))
	const match = matches[0]
	if (matches.length === 1 && match) return match.name
	if (matches.length === 0) {
		throw new CliError(
			`could not infer provider for type "${type}"`,
			"PROVIDER_INFERENCE_FAILED",
			"pass --provider <name> to pick one explicitly",
		)
	}
	throw new CliError(
		`type "${type}" prefix matches multiple providers: ${matches.map((m) => m.name).join(", ")}`,
		"PROVIDER_INFERENCE_AMBIGUOUS",
		"pass --provider <name> to pick one explicitly",
	)
}

// What a resource needs to be imported. Returns null when it can't be
// resolved (type unknown, or the schema endpoint errored) so callers degrade
// — surfacing a hint is best-effort, never a reason to abort.
export async function fetchImportIdentity(
	deps: HandlerDeps,
	provider: string,
	type: string,
): Promise<ImportIdentity | null> {
	const res = await deps.client.providers[":provider"].types[
		":type"
	].identity.$get({ param: { provider, type } })
	if (!res.ok) return null
	return res.json()
}
