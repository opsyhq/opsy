import { relations, sql } from "drizzle-orm"
import {
	boolean,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core"
import { encryptedJsonb } from "../encrypted-jsonb"
import { organization } from "./auth"
import {
	createdByActor,
	scanIntervalEnum,
	softDelete,
	timestamps,
} from "./shared"

export const projects = pgTable(
	"projects",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orgId: uuid("org_id")
			.notNull()
			.references(() => organization.id),
		slug: text("slug").notNull(),
		approvalPolicy: text("approval_policy").array().notNull().default([]),
		scanInterval: scanIntervalEnum("scan_interval").notNull().default("off"),
		// Claim token for the scheduled scan loop. Atomic
		// `UPDATE ... RETURNING` on this column serializes concurrent claimers
		// across API instances. Manual scans also bump it so they debounce the
		// loop on the next tick.
		lastScanClaimedAt: timestamp("last_scan_claimed_at", {
			withTimezone: true,
		}),
		...timestamps,
		...softDelete,
		...createdByActor,
	},
	(t) => [
		uniqueIndex("projects_org_slug_unique")
			.on(t.orgId, t.slug)
			.where(sql`${t.deletedAt} IS NULL`),
	],
)

// Integrations are project-scoped: each row belongs to exactly one project and
// carries its own credentials + config. `slug` is the integration's identity
// within a project — project-unique, user-chosen, no magic value. A project
// can hold several integrations for the same provider (e.g. two AWS accounts
// as `aws-prod` and `aws-west`); exactly one per `(project, provider)` is
// flagged `isDefault` and is what resource creation resolves to when no
// `--integration` is given. `resources.integration_id` references a
// specific integration directly, so credential/config resolution is a single
// row lookup.
export const integrations = pgTable(
	"integrations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id),
		provider: text("provider").notNull(),
		// Project-unique identity. No default value: the slug is always
		// user-chosen and meaningful (enforced by the unique index below).
		slug: text("slug").notNull(),
		// Optional cosmetic label. Not an identifier — the service layer
		// defaults it to `slug` when omitted.
		name: text("profile_name"),
		// Exactly one integration per (project, provider) carries this flag
		// (partial unique index below). It is the integration resolved when a
		// resource is created without an explicit slug.
		isDefault: boolean("is_default").notNull().default(false),
		providerSource: text("provider_source"),
		providerVersion: text("provider_version"),
		config: jsonb("config")
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		// Encrypted at rest (AES-256-GCM) — see ../encrypted-jsonb. Stays jsonb
		// and `Record<string, unknown>`, so callers are unchanged. Runtime
		// `$defaultFn` instead of a SQL default: the empty default must flow
		// through the encrypting codec, not be baked as static ciphertext.
		credentials: encryptedJsonb("credentials")
			.notNull()
			.$defaultFn(() => ({})),
		// Provider-plugin-summarized label for the credential shape (e.g.
		// "static", "static+role"). Populated at create/update via the
		// plugin's `summarizeCredentialMode`. Empty string for rows whose
		// plugin does not summarize, or for legacy rows predating the
		// migration that haven't been re-saved yet.
		credentialMode: text("credential_mode").notNull().default(""),
		...timestamps,
		...softDelete,
		...createdByActor,
	},
	(t) => [
		uniqueIndex("integrations_project_slug_unique")
			.on(t.projectId, t.slug)
			.where(sql`${t.deletedAt} IS NULL`),
		uniqueIndex("integrations_project_provider_default_unique")
			.on(t.projectId, t.provider)
			.where(sql`${t.isDefault} AND ${t.deletedAt} IS NULL`),
	],
)

// Relations
export const projectsRelations = relations(projects, ({ one, many }) => ({
	org: one(organization, {
		fields: [projects.orgId],
		references: [organization.id],
	}),
	integrations: many(integrations),
}))

export const integrationsRelations = relations(integrations, ({ one }) => ({
	project: one(projects, {
		fields: [integrations.projectId],
		references: [projects.id],
	}),
}))
