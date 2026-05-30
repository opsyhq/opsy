import { relations, sql } from "drizzle-orm"
import {
	check,
	jsonb,
	pgTable,
	text,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core"
import { operations } from "./operations"
import { integrations, projects } from "./projects"
import {
	createdByActor,
	resourceStatusEnum,
	softDelete,
	timestamps,
} from "./shared"

// Managed resources only. Facts, not a view-model: the cloud is the only
// truth, there is no desired state. `inputs` is a minimal declared mirror kept
// for audit / cheap reads / future TF export; external changes are silently
// absorbed on read. `outputs` is the full computed cloud-state snapshot from
// the last live read/apply — the surfaceable counterpart to the opaque
// `identity` handle. Display status is derived client-side from these facts +
// the open-operations stream — it is not stored here.
export const resources = pgTable(
	"resources",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id),
		slug: text("slug").notNull(),
		type: text("type").notNull(),
		inputs: jsonb("inputs").$type<Record<string, unknown>>(),
		// IDENTITY HANDLE ONLY. Treat this as an opaque id: it is the address
		// the provider needs to call read() again (the identity fields per
		// entry.identity.fields) and nothing more. It is NOT a snapshot of
		// computed/output state and MUST NOT be rendered or surfaced as such —
		// the surfaceable computed snapshot is the `outputs` column, never this
		// one (no per-key UI handles, no $ref resolution from this column).
		// Current state always comes from a live read against the cloud. NULL
		// identity means the resource has never been applied (pending). Never
		// serialized raw to clients.
		identity: jsonb("identity").$type<Record<string, unknown>>(),
		// FULL COMPUTED SNAPSHOT. The entire provider state from the last live
		// read/apply — every attribute incl. computed outputs (ARNs, generated
		// ids, endpoints). Unlike `inputs` (a minimal declared mirror) this is
		// not projected/narrowed, and unlike `identity` it is safe to serialize
		// to clients. Refreshed on every apply/import and read/scan.
		// NULL means the resource has
		// never been applied/read.
		outputs: jsonb("outputs").$type<Record<string, unknown>>(),
		// Backend-owned lifecycle truth. Set when the row is inserted (creating /
		// importing) and transitioned in-band with the owning operation: update
		// flips to `updating` while the apply runs and back to `live` on
		// success; delete flips to `deleting` while the apply runs (soft-delete
		// on success); read/scan settles on `live` or `missing` per cloud truth.
		// Display status combines this with the open-operations stream client-side.
		status: resourceStatusEnum("status").notNull(),
		provider: text("provider"),
		// FK to the project-scoped integration the resource was created through.
		// Credentials, config, and $ref target resolution all flow from this row.
		// Two integrations for the same provider in one project are disambiguated
		// by their `slug` — see `integrations.slug`.
		integrationId: uuid("integration_id").references(() => integrations.id),
		dependsOn: jsonb("depends_on").$type<string[] | null>(),
		approvalPolicy: text("approval_policy").array(),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		...timestamps,
		...softDelete,
		...createdByActor,
	},
	(t) => [
		uniqueIndex("resources_project_slug_unique")
			.on(t.projectId, t.slug)
			.where(sql`${t.deletedAt} IS NULL`),
		check(
			"resources_provider_backed_check",
			sql`(${t.provider} IS NULL AND ${t.integrationId} IS NULL) OR (${t.provider} IS NOT NULL AND ${t.integrationId} IS NOT NULL)`,
		),
	],
)

// Relations
export const resourcesRelations = relations(resources, ({ one, many }) => ({
	project: one(projects, {
		fields: [resources.projectId],
		references: [projects.id],
	}),
	integration: one(integrations, {
		fields: [resources.integrationId],
		references: [integrations.id],
	}),
	operations: many(operations),
}))
