import path from "node:path"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate as drizzleMigrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"
import { env } from "../env"

export async function migrate() {
	const connection = postgres(env.DATABASE_URL, {
		max: 1,
		onnotice: () => {},
	})
	const db = drizzle(connection)

	const migrationsFolder = path.resolve(import.meta.dirname, "../../../drizzle")
	await drizzleMigrate(db, { migrationsFolder })
	await connection.end()
}
