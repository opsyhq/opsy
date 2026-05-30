import { sql } from "drizzle-orm"
import { db, shutdownDb } from "../src/lib/db/client"
import { encryptJson } from "../src/lib/db/encrypted-jsonb"

// One-off backfill: encrypt integration credentials that were written as
// plaintext before at-rest encryption landed. Idempotent — a row already in
// envelope form is left untouched, so re-running is safe. Soft-deleted rows
// are included: their plaintext is still on disk. Run with the same
// CREDENTIALS_ENCRYPTION_KEY the app uses (`bun run --env-file .env ...`)
// so the app can decrypt the result.
//
// This is a data backfill that needs app-side crypto, so it cannot be a
// generated SQL migration — hence a script, per the scripts/ convention.

function isEnvelope(value: unknown): boolean {
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
		sql`select id, credentials from integrations`,
	)) as unknown as Array<{ id: string; credentials: unknown }>

	let scanned = 0
	let encrypted = 0
	let alreadyEncrypted = 0

	await db.transaction(async (tx) => {
		for (const row of rows) {
			scanned += 1
			const stored =
				typeof row.credentials === "string"
					? JSON.parse(row.credentials)
					: row.credentials

			if (isEnvelope(stored)) {
				alreadyEncrypted += 1
				continue
			}

			const plaintext = (stored ?? {}) as Record<string, unknown>
			const envelope = JSON.stringify(encryptJson(plaintext))
			await tx.execute(
				sql`update integrations set credentials = ${envelope}::jsonb where id = ${row.id}`,
			)
			encrypted += 1
		}
	})

	console.log(
		JSON.stringify({ scanned, encrypted, alreadyEncrypted }, null, 2),
	)
}

main()
	.then(() => shutdownDb())
	.catch(async (err) => {
		console.error(err)
		await shutdownDb()
		process.exit(1)
	})
