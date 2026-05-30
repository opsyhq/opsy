import { findProviderIntegrationDefinition } from "@opsy/provider"
import { sql } from "drizzle-orm"
import { db, shutdownDb } from "../src/lib/db/client"
import { decryptJson, encryptJson } from "../src/lib/db/encrypted-jsonb"

// One-off backfill: bring stored integration credentials onto the V2 shape
// expected by the rewired AWS schema and populate the new
// `credential_mode` column. Two transforms per row, both idempotent:
//
//   1. AWS rows whose credentials carry `{ mode: "static" | "assume_role" }`
//      (pre-V2 shape) — rename `mode` → `source`. Any other shape (already
//      `source`-keyed, no discriminator at all, non-AWS providers) is left
//      untouched.
//   2. Any row whose `credential_mode` column is empty — re-compute via the
//      plugin's `summarizeCredentialMode` and write back. Rows whose
//      credentials don't parse against the plugin schema are reported and
//      skipped (no half-typed writes).
//
// Run via the existing env-aware launcher so the CREDENTIALS_ENCRYPTION_KEY
// matches the app: `bun run --env-file .env scripts/migrate-aws-credentials-source.ts`.

function isEnvelope(value: unknown): value is {
	v: number
	iv: string
	tag: string
	ct: string
} {
	return (
		typeof value === "object" &&
		value !== null &&
		"v" in value &&
		"iv" in value &&
		"tag" in value &&
		"ct" in value
	)
}

async function main() {
	const rows = (await db.execute(
		sql`select id, provider, provider_source as "providerSource", credentials, credential_mode as "credentialMode" from integrations`,
	)) as unknown as Array<{
		id: string
		provider: string
		providerSource: string | null
		credentials: unknown
		credentialMode: string
	}>

	let scanned = 0
	let renamed = 0
	let modeBackfilled = 0
	const skipped: { id: string; reason: string }[] = []

	await db.transaction(async (tx) => {
		for (const row of rows) {
			scanned += 1
			const stored =
				typeof row.credentials === "string"
					? JSON.parse(row.credentials)
					: row.credentials
			if (!isEnvelope(stored)) {
				skipped.push({ id: row.id, reason: "credentials not in envelope form" })
				continue
			}

			const plaintext = decryptJson(stored)
			let creds = plaintext
			let needsCredentialsWrite = false

			if (row.provider === "aws" && !("source" in creds)) {
				if (typeof creds["mode"] === "string") {
					const { mode, ...rest } = creds
					creds = { source: mode, ...rest }
					needsCredentialsWrite = true
				} else if (
					typeof creds["access_key"] === "string" &&
					typeof creds["secret_key"] === "string"
				) {
					creds = { source: "static", ...creds }
					needsCredentialsWrite = true
				} else if (
					typeof creds["role_arn"] === "string"
				) {
					creds = { source: "assume_role", ...creds }
					needsCredentialsWrite = true
				}
			}

			const definition = findProviderIntegrationDefinition({
				name: row.provider,
				source: row.providerSource ?? undefined,
			})
			let nextMode: string | null = null
			if (definition?.summarizeCredentialMode) {
				const parsed = definition.credentialsSchema?.safeParse(creds)
				if (parsed && !parsed.success) {
					skipped.push({
						id: row.id,
						reason: `credentials do not parse: ${parsed.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join("; ")}`,
					})
					continue
				}
				nextMode = definition.summarizeCredentialMode(creds)
			}

			const needsModeWrite =
				nextMode !== null && nextMode !== "" && row.credentialMode !== nextMode

			if (!needsCredentialsWrite && !needsModeWrite) continue

			const credsEnvelope = needsCredentialsWrite
				? JSON.stringify(encryptJson(creds))
				: null
			if (credsEnvelope && needsModeWrite) {
				await tx.execute(
					sql`update integrations set credentials = ${credsEnvelope}::jsonb, credential_mode = ${nextMode} where id = ${row.id}`,
				)
			} else if (credsEnvelope) {
				await tx.execute(
					sql`update integrations set credentials = ${credsEnvelope}::jsonb where id = ${row.id}`,
				)
			} else if (needsModeWrite) {
				await tx.execute(
					sql`update integrations set credential_mode = ${nextMode} where id = ${row.id}`,
				)
			}
			if (needsCredentialsWrite) renamed += 1
			if (needsModeWrite) modeBackfilled += 1
		}
	})

	console.log(
		JSON.stringify({ scanned, renamed, modeBackfilled, skipped }, null, 2),
	)
}

main()
	.then(() => shutdownDb())
	.catch(async (err) => {
		console.error(err)
		await shutdownDb()
		process.exit(1)
	})
