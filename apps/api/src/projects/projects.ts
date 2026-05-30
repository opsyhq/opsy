import {
	Conflict,
	ProjectActiveResourcesConflict,
	ProjectCreateFailed,
	ProjectDuplicateSlug,
	ProjectNotFound,
	ProjectUpdateFailed,
} from "@opsy/contracts/errors"
import { and, eq, isNull, sql } from "drizzle-orm"
import { start } from "workflow/api"
import { systemActor } from "../lib/actor"
import { db } from "../lib/db/client"
import { type Operation, type Project, projects, resources } from "../lib/db/schema"
import { softDeleteOne } from "../lib/db/softDelete"
import { baseLogger } from "../lib/logger"
import * as operations from "../operations"
import type { Actor } from "../types"
import type { ScanProjectBody } from "./workflows/steps"
import { scanProjectWorkflow } from "./workflows/index"
import type { CreateProjectBody, UpdateProjectBody } from "./schemas"

const log = baseLogger.child({ module: "scan" })

const TICK_INTERVAL_MS = 60_000

export async function createProject(
	actor: Actor,
	body: CreateProjectBody,
): Promise<Project> {
	const existing = await db.query.projects.findFirst({
		where: and(
			eq(projects.orgId, actor.orgId),
			eq(projects.slug, body.slug),
			isNull(projects.deletedAt),
		),
	})
	if (existing) throw new ProjectDuplicateSlug({ slug: body.slug })

	const [row] = await db
		.insert(projects)
		.values({
			orgId: actor.orgId,
			slug: body.slug,
			createdByType: actor.type,
			createdById: actor.id,
		})
		.returning()
	if (!row) throw new ProjectCreateFailed()
	return row
}

export async function listProjects(actor: Actor): Promise<Project[]> {
	return db.query.projects.findMany({
		where: and(eq(projects.orgId, actor.orgId), isNull(projects.deletedAt)),
		orderBy: (t, { asc }) => [asc(t.slug)],
	})
}

export async function getProjectBySlug(actor: Actor, slug: string): Promise<Project> {
	const row = await db.query.projects.findFirst({
		where: and(
			eq(projects.orgId, actor.orgId),
			eq(projects.slug, slug),
			isNull(projects.deletedAt),
		),
	})
	if (!row) throw new ProjectNotFound({ slug })
	return row
}

// Refuses if any active resource exists in the project — those need to be torn
// down via their own change flows first, otherwise you'd orphan live cloud
// infrastructure. See softDelete.ts for --force semantics.
export async function deleteProject(
	actor: Actor,
	slug: string,
	{ force = false }: { force?: boolean } = {},
): Promise<void> {
	const [live] = await db
		.select({ id: resources.id })
		.from(resources)
		.innerJoin(projects, eq(projects.id, resources.projectId))
		.where(
			and(
				eq(projects.orgId, actor.orgId),
				eq(projects.slug, slug),
				isNull(projects.deletedAt),
				isNull(resources.deletedAt),
			),
		)
		.limit(1)
	if (live) throw new ProjectActiveResourcesConflict({ slug })
	await softDeleteOne({
		tx: db,
		table: projects,
		where: and(eq(projects.orgId, actor.orgId), eq(projects.slug, slug))!,
		force,
		notFoundMessage: `project not found: ${slug}`,
	})
}

export async function updateProject(
	actor: Actor,
	slug: string,
	body: UpdateProjectBody,
): Promise<Project> {
	const row = await db.query.projects.findFirst({
		where: and(
			eq(projects.orgId, actor.orgId),
			eq(projects.slug, slug),
			isNull(projects.deletedAt),
		),
	})
	if (!row) throw new ProjectNotFound({ slug })
	const [updated] = await db
		.update(projects)
		.set(body)
		.where(eq(projects.id, row.id))
		.returning()
	if (!updated) throw new ProjectUpdateFailed()
	return updated
}

// The only site that writes lastScanClaimedAt. Private to this module — the
// public surface for starting a scan is startProjectScan.
async function claimProjectScan(projectId: string): Promise<void> {
	await db
		.update(projects)
		.set({ lastScanClaimedAt: sql`now()` })
		.where(eq(projects.id, projectId))
}

export async function startProjectScan(
	actor: Actor,
	project: Project,
): Promise<{ operation: Operation<ScanProjectBody> }> {
	const operation = await operations.createOperation<ScanProjectBody>({
		actor,
		projectId: project.id,
		kind: "scan",
		lockKey: `scan:${project.id}`,
		request: {},
	})

	await claimProjectScan(project.id)

	const run = await start(scanProjectWorkflow, [operation]).catch(
		async (error) => {
			await operations
				.markOperationFailed(
					operation,
					operations.describeOperationError(error),
				)
				.catch((err) =>
					log.error(
						{ err, operationId: operation.id },
						"failed to close scan operation after workflow start failure",
					),
				)
			throw error
		},
	)

	return {
		operation: await operations.attachOperationWorkflowRun(operation, run.runId),
	}
}

let loopHandle: ReturnType<typeof setInterval> | null = null

export function startScanLoop(): void {
	if (process.env.OPSY_SCANS_DISABLED === "1") {
		log.info("scan loop disabled via OPSY_SCANS_DISABLED")
		return
	}
	if (loopHandle) return
	loopHandle = setInterval(() => {
		void runScanLoopTick().catch((err) => log.error({ err }, "scan loop tick failed"))
	}, TICK_INTERVAL_MS)
	if (typeof loopHandle.unref === "function") loopHandle.unref()
}

export function stopScanLoop(): void {
	if (loopHandle) {
		clearInterval(loopHandle)
		loopHandle = null
	}
}

// Eligibility is a read-only select: it never decides who runs. The atomic
// claim is the scan operation insert inside startProjectScan(), serialized by
// the `operations_open_lock_unique` partial index on (project_id, lock_key) —
// the same mechanism resources/changesets use. A concurrent tick that loses
// the insert race surfaces as `Conflict`, which means "already claimed
// elsewhere", not an error to log.
export async function runScanLoopTick(): Promise<void> {
	const eligible = await db.query.projects.findMany({
		where: sql`
			deleted_at IS NULL
			AND scan_interval <> 'off'
			AND (
				last_scan_claimed_at IS NULL
				OR last_scan_claimed_at + CASE scan_interval
					WHEN 'hourly' THEN interval '1 hour'
					WHEN 'daily' THEN interval '24 hours'
				END < now()
			)
		`,
	})

	await Promise.allSettled(
		eligible.map(async (project) => {
			try {
				await startProjectScan(systemActor(project.orgId), project)
			} catch (err) {
				if (err instanceof Conflict) return
				log.error({ err, projectId: project.id }, "scheduled scan failed")
			}
		}),
	)
}
