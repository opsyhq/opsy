import { afterEach, beforeAll, describe, expect, test } from "bun:test"
import {
	IntegrationCredentialsInvalid,
	ProviderUnknown,
	ProviderVersionUnavailable,
} from "@opsy/contracts/errors"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import { type Project, projects } from "@/lib/db/schema"
import {
	clearTerraformRuntimeCacheForTest,
	setTerraformBridgeClientForTest,
	setTerraformProviderCatalogForTest,
} from "@/provider-runtime"
import { createSchemaBridgeForTest } from "@/test/fake-bridge"
import type { Actor } from "@/types"
import { createIntegration, updateIntegration } from ".."
import { makeActor } from "./fixtures"

function installTerraformRuntime(
	entries: { name: string; source: string; versions: string[] }[],
) {
	setTerraformProviderCatalogForTest(entries)
	setTerraformBridgeClientForTest(createSchemaBridgeForTest())
	clearTerraformRuntimeCacheForTest()
}

async function makeProject(actor: Actor): Promise<Project> {
	const [row] = await db
		.insert(projects)
		.values({
			orgId: actor.orgId,
			slug: `p-${crypto.randomUUID().slice(0, 10)}`,
			createdByType: actor.type,
			createdById: actor.id,
		})
		.returning()
	if (!row) throw new Error("failed to insert project")
	return row
}

const validStaticCredentials = {
	source: "static",
	access_key: "A".repeat(16),
	secret_key: "secret",
}

const validAssumeRoleCredentials = {
	source: "assume_role",
	role_arn: "arn:aws:iam::123456789012:role/OpsyRole",
	external_id: "ext-id",
	session_name: "opsy",
}

beforeAll(async () => {
	await migrate()
})

afterEach(() => {
	setTerraformBridgeClientForTest(null)
	setTerraformProviderCatalogForTest(null)
	clearTerraformRuntimeCacheForTest()
})

describe("createIntegration", () => {
	test("stores valid static credentials and summarizes the mode", async () => {
		installTerraformRuntime([
			{ name: "aws", source: "hashicorp/aws", versions: ["6.44.0"] },
		])
		const actor = await makeActor("create")
		const project = await makeProject(actor)

		const row = await createIntegration(actor, project, {
			provider: "aws",
			slug: "static-only",
			name: "static-only",
			credentials: validStaticCredentials,
			config: { region: "us-east-1" },
		})
		expect(row.id).toBeString()
		expect(row.provider).toBe("aws")
		expect(row.providerSource).toBe("hashicorp/aws")
		expect(row.providerVersion).toBe("6.44.0")
		expect(row.credentials).toEqual(validStaticCredentials)
		expect(row.credentialMode).toBe("static")
		expect(row.config).toEqual({ region: "us-east-1" })
	})

	test("summarizes mode as assume_role when source is assume_role", async () => {
		installTerraformRuntime([
			{ name: "aws", source: "hashicorp/aws", versions: ["6.44.0"] },
		])
		const actor = await makeActor("create")
		const project = await makeProject(actor)

		const row = await createIntegration(actor, project, {
			provider: "aws",
			slug: "assume-role-only",
			name: "assume-role-only",
			credentials: validAssumeRoleCredentials,
			config: { region: "us-east-1" },
		})
		expect(row.credentialMode).toBe("assume_role")
	})

	test("encrypts credentials at rest — raw column is a GCM envelope, not plaintext", async () => {
		installTerraformRuntime([
			{ name: "aws", source: "hashicorp/aws", versions: ["6.44.0"] },
		])
		const actor = await makeActor("create")
		const project = await makeProject(actor)

		const row = await createIntegration(actor, project, {
			provider: "aws",
			slug: "at-rest",
			name: "at-rest",
			credentials: {
				source: "static",
				access_key: "A".repeat(16),
				secret_key: "top-secret-value",
			},
			config: { region: "us-east-1" },
		})

		// Service round-trip still yields plaintext: the codec decrypts on read.
		expect((row.credentials as { secret_key: string }).secret_key).toBe(
			"top-secret-value",
		)

		// Raw read bypasses the column codec → the stored value must be the
		// self-describing envelope, with the secret nowhere in it.
		const raw = (await db.execute(
			sql`select credentials from integrations where id = ${row.id}`,
		)) as unknown as Array<{ credentials: Record<string, unknown> }>
		const stored = raw[0]?.credentials
		expect(stored).toBeDefined()
		expect(Object.keys(stored as object).sort()).toEqual([
			"ct",
			"iv",
			"tag",
			"v",
		])
		expect(JSON.stringify(stored)).not.toContain("top-secret-value")
	})

	test("rejects garbage credentials at ingest with IntegrationCredentialsInvalid", async () => {
		installTerraformRuntime([
			{ name: "aws", source: "hashicorp/aws", versions: ["6.44.0"] },
		])
		const actor = await makeActor("create")
		const project = await makeProject(actor)

		await expect(
			createIntegration(actor, project, {
				provider: "aws",
				slug: "garbage",
				name: "garbage",
				credentials: { mode: "static", access_key: "short" },
				config: { region: "us-east-1" },
			}),
		).rejects.toBeInstanceOf(IntegrationCredentialsInvalid)
	})

	test("rejects missing credentials at ingest for schema-bearing providers", async () => {
		installTerraformRuntime([
			{ name: "aws", source: "hashicorp/aws", versions: ["6.44.0"] },
		])
		const actor = await makeActor("create")
		const project = await makeProject(actor)

		// Omitted credentials default to `{}` — that's invalid against the
		// strict AWS schema and should fail at ingest, not at apply time.
		await expect(
			createIntegration(actor, project, {
				provider: "aws",
				slug: "omitted-creds",
				name: "omitted-creds",
				config: { region: "us-east-1" },
			}),
		).rejects.toBeInstanceOf(IntegrationCredentialsInvalid)
	})

	test("accepts future-shaped AWS regions without catalog enum changes", async () => {
		installTerraformRuntime([
			{ name: "aws", source: "hashicorp/aws", versions: ["6.44.0"] },
		])
		const actor = await makeActor("create")
		const project = await makeProject(actor)

		const row = await createIntegration(actor, project, {
			provider: "aws",
			slug: "future-region",
			name: "future-region",
			credentials: validStaticCredentials,
			config: { region: "eusc-de-east-1" },
		})

		expect(row.config).toEqual({ region: "eusc-de-east-1" })
	})

	test("updateIntegration with credentials acts as an authoritative replacement", async () => {
		installTerraformRuntime([
			{ name: "aws", source: "hashicorp/aws", versions: ["6.44.0"] },
		])
		const actor = await makeActor("update")
		const project = await makeProject(actor)
		const row = await createIntegration(actor, project, {
			provider: "aws",
			slug: "rotate-static",
			name: "rotate-static",
			credentials: {
				source: "static",
				access_key: "A".repeat(16),
				secret_key: "original-secret",
			},
			config: { region: "us-east-1" },
		})

		const updated = await updateIntegration(project, row.slug, {
			credentials: {
				source: "static",
				access_key: "B".repeat(16),
				secret_key: "rotated-secret",
			},
		})

		expect(updated.credentials).toEqual({
			source: "static",
			access_key: "B".repeat(16),
			secret_key: "rotated-secret",
		})
		expect(updated.credentialMode).toBe("static")
	})

	test("updateIntegration preserves stored credentials when the field is omitted", async () => {
		installTerraformRuntime([
			{ name: "aws", source: "hashicorp/aws", versions: ["6.44.0"] },
		])
		const actor = await makeActor("update")
		const project = await makeProject(actor)
		const row = await createIntegration(actor, project, {
			provider: "aws",
			slug: "no-rotate",
			name: "no-rotate",
			credentials: validStaticCredentials,
			config: { region: "us-east-1" },
		})

		const updated = await updateIntegration(project, row.slug, {
			name: "renamed",
		})

		expect(updated.credentials).toEqual(validStaticCredentials)
		expect(updated.name).toBe("renamed")
	})

	test("updateIntegration rejects garbage credentials at ingest", async () => {
		installTerraformRuntime([
			{ name: "aws", source: "hashicorp/aws", versions: ["6.44.0"] },
		])
		const actor = await makeActor("update")
		const project = await makeProject(actor)
		const row = await createIntegration(actor, project, {
			provider: "aws",
			slug: "rotate-fail",
			name: "rotate-fail",
			credentials: validStaticCredentials,
			config: { region: "us-east-1" },
		})

		await expect(
			updateIntegration(project, row.slug, {
				credentials: { source: "static", access_key: "too-short" },
			}),
		).rejects.toBeInstanceOf(IntegrationCredentialsInvalid)
	})

	test("rejects unavailable provider version", async () => {
		installTerraformRuntime([
			{ name: "aws", source: "hashicorp/aws", versions: ["6.44.0"] },
		])
		const actor = await makeActor("create")
		const project = await makeProject(actor)

		await expect(
			createIntegration(actor, project, {
				provider: "aws",
				providerVersion: "1.2.3",
				slug: "wrong-version",
				name: "wrong-version",
				credentials: validStaticCredentials,
				config: { region: "us-east-1" },
			}),
		).rejects.toBeInstanceOf(ProviderVersionUnavailable)
	})

	test("rejects unknown provider", async () => {
		const actor = await makeActor("create")
		const project = await makeProject(actor)
		try {
			await createIntegration(actor, project, {
				provider: "does-not-exist",
				slug: "x",
				name: "x",
				config: {},
			})
			expect.unreachable("expected ProviderUnknown")
		} catch (err) {
			expect(err).toBeInstanceOf(ProviderUnknown)
			expect(String((err as Error).message)).toContain("unknown provider")
		}
	})
})
