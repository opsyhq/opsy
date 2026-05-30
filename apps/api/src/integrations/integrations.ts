import {
	IntegrationActiveResourcesConflict,
	IntegrationConfigInvalid,
	IntegrationCreateFailed,
	IntegrationCredentialsInvalid,
	IntegrationDuplicateSlug,
	IntegrationNoDefault,
	IntegrationNotFound,
	IntegrationProviderMismatch,
	IntegrationSlugNotFound,
	IntegrationUnknownProvider,
	ProviderInferTypeFailed,
} from "@opsy/contracts/errors"
import {
	findProviderIntegrationDefinition,
	type IntegrationCheckResult,
	type ProviderIntegrationDefinition,
} from "@opsy/provider"
import { and, eq, inArray, isNull } from "drizzle-orm"
import { z } from "zod"
import { db } from "../lib/db/client"
import { uniqueViolationConstraint } from "../lib/db/errors"
import {
	type IntegrationRow,
	integrations,
	type Project,
	resources,
} from "../lib/db/schema"
import { softDeleteOne } from "../lib/db/softDelete"
import {
	providerIdentityPatch,
	providerRefFromCreateBody,
	providerRefFromIntegration,
	providerRuntime,
} from "../provider-runtime"
import type { Actor } from "../types"
import type {
	CheckExistingIntegrationBody,
	CheckIntegrationBody,
	CreateIntegrationBody,
	UpdateIntegrationBody,
} from "./schemas"

export type IntegrationView = Omit<
	IntegrationRow,
	"credentials" | "credentialMode"
> & {
	credentialDiscriminator: string | null
	// Projected from the row's stored `credentialMode` column (renamed at the
	// boundary to match the FE consumer's "credentialsMode" terminology).
	// Empty stored value becomes null.
	credentialsMode: string | null
	// Provider-declared onboarding identifier (e.g. AWS assume-role external
	// id). Not a secret — its purpose is to be pasted into the customer's
	// trust policy — so it is surfaced even though the rest of the
	// credentials blob is omitted. null unless the provider defines onboarding
	// and the stored row carries the expected onboarding shape.
	onboardingExternalId: string | null
}

// Required by the plugin registry — an integration whose provider is not
// registered cannot validate, summarize, or map its credentials, so we fail
// closed at the ingest boundary rather than carry through a half-typed row.
function requireProviderDefinition(
	providerName: string,
): ProviderIntegrationDefinition {
	const definition = findProviderIntegrationDefinition({ name: providerName })
	if (!definition) throw new IntegrationUnknownProvider({ providerName })
	return definition
}

function formatZodIssues(err: z.ZodError): string {
	return err.issues
		.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
		.join("; ")
}

// Parses credentials and config against the plugin's schemas at the ingest
// boundary — anything that reaches storage is shape-correct. The provider
// runtime still re-parses at provider-config-mapping time (the security
// boundary that owns the TF translation), so this is defense in depth, not
// duplication.
function validateAtIngest(
	definition: ProviderIntegrationDefinition,
	input: { credentials?: Record<string, unknown>; config?: Record<string, unknown> },
): void {
	if (definition.credentialsSchema && input.credentials !== undefined) {
		const result = definition.credentialsSchema.safeParse(input.credentials)
		if (!result.success) {
			throw new IntegrationCredentialsInvalid({
				providerName: definition.name,
				issues: formatZodIssues(result.error),
			})
		}
	}
	if (definition.configSchema && input.config !== undefined) {
		const result = definition.configSchema.safeParse(input.config)
		if (!result.success) {
			throw new IntegrationConfigInvalid({
				providerName: definition.name,
				issues: formatZodIssues(result.error),
			})
		}
	}
}

function summarizeMode(
	definition: ProviderIntegrationDefinition,
	credentials: Record<string, unknown>,
): string {
	return definition.summarizeCredentialMode?.(credentials) ?? ""
}

export function getIntegrationView(row: IntegrationRow): IntegrationView {
	const { credentials, credentialMode, ...rest } = row
	const definition = findProviderIntegrationDefinition({
		name: row.provider,
		source: row.providerSource,
	})
	const discriminator = definition?.credentialDiscriminator ?? null
	const onboarding = definition?.onboarding ?? null
	// The stored credential_mode column is the source of truth (populated at
	// create/update via the plugin summarizer). The credentials blob is no
	// longer projected by the view — that's the write-only protocol.
	const credentialsMode = credentialMode || null
	const credsObject =
		typeof credentials === "object" && credentials !== null ? credentials : null
	// The provider-declared externalIdField lives at the top of the credentials
	// blob (AWS: `external_id` under source=assume_role). Project it when the
	// row's stored value is a string; otherwise the trust-policy card has
	// nothing to display.
	const onboardingExternalId = (() => {
		if (!onboarding || !credsObject) return null
		const candidate = Reflect.get(credsObject, onboarding.externalIdField)
		return typeof candidate === "string" ? candidate : null
	})()
	return {
		...rest,
		credentialDiscriminator: discriminator,
		credentialsMode,
		onboardingExternalId,
	}
}

// Demote the current default for (project, provider) inside `tx`. Used by
// both create (when a non-first default is requested) and update (when
// promoting another row to default).
async function demoteCurrentDefault(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	projectId: string,
	provider: string,
): Promise<void> {
	await tx
		.update(integrations)
		.set({ isDefault: false })
		.where(
			and(
				eq(integrations.projectId, projectId),
				eq(integrations.provider, provider),
				eq(integrations.isDefault, true),
				isNull(integrations.deletedAt),
			),
		)
}

export async function createIntegration(
	actor: Actor,
	project: Project,
	body: CreateIntegrationBody,
): Promise<IntegrationRow> {
	const ref = providerRefFromCreateBody(body)
	const definition = requireProviderDefinition(ref.name)
	const credentials = body.credentials ?? {}
	validateAtIngest(definition, { credentials, config: body.config })
	const credentialMode = summarizeMode(definition, credentials)
	try {
		return await db.transaction(async (tx) => {
			// The first integration for a (project, provider) is always the
			// default — that's what keeps single-integration projects working
			// with zero flags. `--default` on a later one moves the flag.
			const firstForProvider = !(await tx.query.integrations.findFirst({
				where: and(
					eq(integrations.projectId, project.id),
					eq(integrations.provider, ref.name),
					isNull(integrations.deletedAt),
				),
				columns: { id: true },
			}))
			const isDefault = body.default === true || firstForProvider
			if (isDefault && !firstForProvider) {
				await demoteCurrentDefault(tx, project.id, ref.name)
			}
			const [row] = await tx
				.insert(integrations)
				.values({
					projectId: project.id,
					provider: ref.name,
					...providerIdentityPatch(ref),
					slug: body.slug,
					name: body.name ?? body.slug,
					isDefault,
					credentials,
					credentialMode,
					config: body.config,
					createdByType: actor.type,
					createdById: actor.id,
				})
				.returning()
			if (!row) throw new IntegrationCreateFailed()
			return row
		})
	} catch (err) {
		if (uniqueViolationConstraint(err) === "integrations_project_slug_unique") {
			throw new IntegrationDuplicateSlug({
				slug: body.slug,
				projectSlug: project.slug,
			})
		}
		throw err
	}
}

export async function checkIntegrationCredentials(
	body: CheckIntegrationBody,
): Promise<IntegrationCheckResult> {
	const ref = providerRefFromCreateBody(body)
	const definition = requireProviderDefinition(ref.name)
	validateAtIngest(definition, {
		credentials: body.credentials,
		config: body.config,
	})
	const provider = await providerRuntime.require(ref)
	return provider.checkIntegration({
		provider: ref.name,
		credentials: body.credentials ?? {},
		config: body.config,
		providerVersion: ref.version,
	})
}

export async function checkIntegration(
	project: Project,
	slug: string,
	body: CheckExistingIntegrationBody = {},
): Promise<IntegrationCheckResult> {
	const row = await getIntegrationBySlug(project.id, slug)
	const ref = providerRefFromIntegration(row)
	const definition = requireProviderDefinition(row.provider)
	validateAtIngest(definition, {
		credentials: body.credentials,
		config: body.config,
	})
	const provider = await providerRuntime.require(ref)
	return provider.checkIntegration({
		provider: row.provider,
		// Write-only credentials: a present `credentials` field is an
		// authoritative replacement to test against (without persisting). An
		// absent field falls back to the stored credentials. No sentinel
		// merging.
		credentials: body.credentials ?? row.credentials,
		config: body.config ?? row.config,
		providerVersion: ref.version,
	})
}

export async function getIntegrationsByProject(
	project: Project,
): Promise<IntegrationRow[]> {
	return db.query.integrations.findMany({
		where: and(
			eq(integrations.projectId, project.id),
			isNull(integrations.deletedAt),
		),
		orderBy: (table, { asc }) => [asc(table.provider), asc(table.slug)],
	})
}

export async function getIntegrationById(
	projectId: string,
	id: string,
): Promise<IntegrationRow> {
	const row = await db.query.integrations.findFirst({
		where: and(
			eq(integrations.id, id),
			eq(integrations.projectId, projectId),
			isNull(integrations.deletedAt),
		),
	})
	if (!row) throw new IntegrationNotFound({ id })
	return row
}

// Slug is the project-unique, user-facing identity.
export async function getIntegrationBySlug(
	projectId: string,
	slug: string,
): Promise<IntegrationRow> {
	const row = await db.query.integrations.findFirst({
		where: and(
			eq(integrations.projectId, projectId),
			eq(integrations.slug, slug),
			isNull(integrations.deletedAt),
		),
	})
	if (!row)
		throw new IntegrationSlugNotFound({
			slug,
			hint: "run `opsy get integrations` to see existing slugs",
		})
	return row
}

// The single default integration for a (project, provider). Callers that
// have a slug should use `getIntegrationBySlug`; callers that have a
// resource type should use `getIntegrationByResourceType`.
export async function getDefaultIntegrationByProvider(
	projectId: string,
	provider: string,
): Promise<IntegrationRow> {
	const row = await db.query.integrations.findFirst({
		where: and(
			eq(integrations.projectId, projectId),
			eq(integrations.provider, provider),
			eq(integrations.isDefault, true),
			isNull(integrations.deletedAt),
		),
	})
	if (!row) throw new IntegrationNoDefault({ provider })
	return row
}

// "Given a project + a resource type, plus an optional explicit slug, which
// integration do we use?" — the single resolver for the resource / import /
// lookup / changeset paths. Infers the provider from the `<provider>_<kind>`
// type prefix.
//   - slug given     → the project-unique row for that slug, asserting it
//                       actually belongs to the inferred provider
//   - slug omitted   → that provider's default integration
export async function getIntegrationByResourceType(
	projectId: string,
	type: string,
	slug?: string,
): Promise<IntegrationRow> {
	const idx = type.indexOf("_")
	if (idx === -1) throw new ProviderInferTypeFailed({ type })
	const provider = type.slice(0, idx)
	if (slug) {
		const row = await getIntegrationBySlug(projectId, slug)
		if (row.provider !== provider) {
			throw new IntegrationProviderMismatch({
				slug,
				expected: provider,
				actual: row.provider,
			})
		}
		return row
	}
	return getDefaultIntegrationByProvider(projectId, provider)
}

export async function getIntegrationsByIds(
	projectId: string,
	ids: string[],
): Promise<Map<string, IntegrationRow>> {
	if (ids.length === 0) return new Map()
	const rows = await db.query.integrations.findMany({
		where: and(
			eq(integrations.projectId, projectId),
			inArray(integrations.id, ids),
			isNull(integrations.deletedAt),
		),
	})
	return new Map(rows.map((row) => [row.id, row]))
}

export async function deleteIntegration(
	project: Project,
	slug: string,
	{ force = false }: { force?: boolean } = {},
): Promise<{ deleted: boolean }> {
	let row: IntegrationRow
	try {
		row = await getIntegrationBySlug(project.id, slug)
	} catch (err) {
		if (force && err instanceof IntegrationSlugNotFound) {
			return { deleted: false }
		}
		throw err
	}
	const [active] = await db
		.select({ id: resources.id })
		.from(resources)
		.where(
			and(eq(resources.integrationId, row.id), isNull(resources.deletedAt)),
		)
		.limit(1)
	if (active) throw new IntegrationActiveResourcesConflict({ slug })
	// Deleting the provider's default just leaves it without one; the next
	// slug-less resolution returns IntegrationNoDefault with a clear next
	// step. No silent re-pointing.
	return softDeleteOne({
		tx: db,
		table: integrations,
		where: eq(integrations.id, row.id),
		force,
		notFoundMessage: `integration not found: ${slug}`,
	})
}

export async function updateIntegration(
	project: Project,
	slug: string,
	body: UpdateIntegrationBody,
): Promise<IntegrationRow> {
	return db.transaction(async (tx) => {
		const row = await tx.query.integrations.findFirst({
			where: and(
				eq(integrations.slug, slug),
				eq(integrations.projectId, project.id),
				isNull(integrations.deletedAt),
			),
		})
		if (!row)
			throw new IntegrationSlugNotFound({
				slug,
				hint: "run `opsy get integrations` to see existing slugs",
			})

		const definition = requireProviderDefinition(row.provider)
		validateAtIngest(definition, {
			credentials: body.credentials,
			config: body.config,
		})

		// Promotion only — you switch a provider's default by promoting
		// another, never by leaving it with none, so `default: false` is a
		// no-op.
		const promoting = body.default === true && !row.isDefault
		// Write-only credentials: a present `credentials` field on PATCH is an
		// authoritative replacement; an absent field keeps the stored payload.
		// The credential_mode column is re-summarized whenever credentials are
		// replaced.
		const nextCredentials =
			body.credentials !== undefined ? body.credentials : null
		const patch = {
			...(body.name !== undefined && { name: body.name }),
			...(nextCredentials !== null && {
				credentials: nextCredentials,
				credentialMode: summarizeMode(definition, nextCredentials),
			}),
			...(body.config !== undefined && { config: body.config }),
			...(promoting && { isDefault: true }),
		}
		if (Object.keys(patch).length === 0) return row

		if (promoting) {
			await demoteCurrentDefault(tx, project.id, row.provider)
		}

		const [updated] = await tx
			.update(integrations)
			.set(patch)
			.where(
				and(
					eq(integrations.id, row.id),
					eq(integrations.projectId, project.id),
				),
			)
			.returning()
		if (!updated) throw new IntegrationNotFound({ id: row.id })
		return updated
	})
}
