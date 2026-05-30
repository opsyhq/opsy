// References resolve from `resources.outputs` — the persisted last-known cloud
// snapshot. Live provider Reads belong to the read workflow alone; ref
// substitution must never bypass it. These tests cover the three observable
// outcomes (ok / not_ready / missing) plus the unknown-slug behavior delegated
// to `substituteRefs`.

import { beforeAll, describe, expect, test } from "bun:test"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import {
	integrations,
	organization,
	projects,
	resources,
	user,
} from "@/lib/db/schema"
import type { Actor } from "@/types"
import { getReferenceTargetsBySlug } from "../references"

beforeAll(async () => {
	await migrate()
})

async function makeProject() {
	const suffix = crypto.randomUUID().slice(0, 12)
	const [u] = await db
		.insert(user)
		.values({ name: "RT Test", email: `rt-${suffix}@example.com` })
		.returning()
	const [org] = await db
		.insert(organization)
		.values({
			name: `rt-org-${suffix}`,
			slug: `rt-org-${suffix}`,
			createdAt: new Date(),
		})
		.returning()
	const actor: Actor = { type: "user", id: u!.id, orgId: org!.id }
	const [project] = await db
		.insert(projects)
		.values({
			orgId: org!.id,
			slug: `rt-proj-${suffix}`,
			createdByType: actor.type,
			createdById: actor.id,
		})
		.returning()
	const [integration] = await db
		.insert(integrations)
		.values({
			projectId: project!.id,
			provider: "fakep",
			slug: "default",
			name: `fakep-${suffix}`,
			createdByType: actor.type,
			createdById: actor.id,
			config: {},
			credentials: {},
		})
		.returning()
	return { actor, project: project!, integration: integration! }
}

describe("getReferenceTargetsBySlug", () => {
	test("reads from resources.outputs and reports per-slug state", async () => {
		const { actor, project, integration } = await makeProject()

		await db.insert(resources).values([
			{
				projectId: project.id,
				slug: "ready",
				type: "fakep_bucket",
				inputs: { id: "x" },
				identity: { id: "x" },
				outputs: { id: "x", arn: "arn:ready" },
				status: "live",
				provider: "fakep",
				integrationId: integration.id,
				createdByType: actor.type,
				createdById: actor.id,
			},
			{
				projectId: project.id,
				slug: "pending",
				type: "fakep_bucket",
				inputs: { id: "y" },
				identity: null,
				outputs: null,
				status: "creating",
				provider: "fakep",
				integrationId: integration.id,
				createdByType: actor.type,
				createdById: actor.id,
			},
			{
				projectId: project.id,
				slug: "gone",
				type: "fakep_bucket",
				inputs: { id: "z" },
				identity: { id: "z" },
				outputs: { id: "z" },
				status: "missing",
				provider: "fakep",
				integrationId: integration.id,
				createdByType: actor.type,
				createdById: actor.id,
			},
		])

		const targets = await getReferenceTargetsBySlug(project.id, [
			"ready",
			"pending",
			"gone",
			"unknown",
		])

		const ready = targets.get("ready")
		const pending = targets.get("pending")
		const gone = targets.get("gone")
		expect(ready?.ok).toBe(true)
		if (!ready?.ok) throw new Error("unreachable")
		expect(ready.state).toEqual({ id: "x", arn: "arn:ready" })

		expect(pending?.ok).toBe(false)
		if (pending?.ok) throw new Error("unreachable")
		expect(pending?.reason).toBe("not_ready")

		expect(gone?.ok).toBe(false)
		if (gone?.ok) throw new Error("unreachable")
		expect(gone?.reason).toBe("missing")

		// Unknown slugs are absent from the map — `substituteRefs` raises
		// `ref_not_found` for them.
		expect(targets.has("unknown")).toBe(false)
	})

	test("empty slug list short-circuits without a DB query", async () => {
		const { project } = await makeProject()
		const targets = await getReferenceTargetsBySlug(project.id, [])
		expect(targets.size).toBe(0)
	})
})
