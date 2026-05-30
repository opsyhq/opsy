// `getResourceViewBySlug` attaches `inlinedInputs` only when `inputs` actually carried
// `$ref`s that resolved — the same structure with refs substituted from the
// target's persisted `outputs` snapshot. Ref-free resources keep the payload
// byte-identical (field omitted), and `inputs` itself is never mutated.

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
import { getResourceViewBySlug } from "../resources"

beforeAll(async () => {
	await migrate()
})

describe("getResourceViewBySlug — inlinedInputs", () => {
	test("ref inputs resolve; ref-free inputs omit the field", async () => {
		const suffix = crypto.randomUUID().slice(0, 12)
		const [u] = await db
			.insert(user)
			.values({ name: "II Test", email: `ii-${suffix}@example.com` })
			.returning()
		const [org] = await db
			.insert(organization)
			.values({
				name: `ii-org-${suffix}`,
				slug: `ii-org-${suffix}`,
				createdAt: new Date(),
			})
			.returning()
		const actor: Actor = { type: "user", id: u!.id, orgId: org!.id }

		const [project] = await db
			.insert(projects)
			.values({
				orgId: org!.id,
				slug: `ii-proj-${suffix}`,
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

		await db.insert(resources).values([
			{
				projectId: project!.id,
				slug: "tgt",
				type: "fakep_bucket",
				inputs: { id: "tgt-1" },
				identity: { id: "tgt-1" },
				outputs: { id: "resolved-tgt-id" },
				status: "live",
				provider: "fakep",
				integrationId: integration!.id,
				createdByType: actor.type,
				createdById: actor.id,
			},
			{
				projectId: project!.id,
				slug: "app",
				type: "fakep_bucket",
				inputs: { subnet: { $ref: "tgt.id" }, name: "literal" },
				status: "creating",
				provider: "fakep",
				integrationId: integration!.id,
				createdByType: actor.type,
				createdById: actor.id,
			},
			{
				projectId: project!.id,
				slug: "plain",
				type: "fakep_bucket",
				inputs: { a: 1 },
				status: "creating",
				provider: "fakep",
				integrationId: integration!.id,
				createdByType: actor.type,
				createdById: actor.id,
			},
		])

		const app = await getResourceViewBySlug(actor, project!, "app")
		expect(app).not.toBeNull()
		// inputs is never rewritten — the ref node is still there...
		expect(app!.inputs).toEqual({ subnet: { $ref: "tgt.id" }, name: "literal" })
		// ...and the resolved projection sits beside it.
		expect(app!.inlinedInputs).toEqual({
			subnet: "resolved-tgt-id",
			name: "literal",
		})

		const plain = await getResourceViewBySlug(actor, project!, "plain")
		expect(plain).not.toBeNull()
		expect(plain!.inputs).toEqual({ a: 1 })
		expect("inlinedInputs" in plain!).toBe(false)
	})
})
