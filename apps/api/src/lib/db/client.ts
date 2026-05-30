import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { env } from "../env"
import * as schema from "./schema"

const connection = postgres(env.DATABASE_URL, {
	max: env.DB_POOL_MAX,
	idle_timeout: env.DB_IDLE_TIMEOUT,
})

export const db = drizzle(connection, { schema })

export async function shutdownDb() {
	await connection.end()
}

/** `db` or a drizzle transaction — use for helpers that work in both. */
export type Executor =
	| typeof db
	| Parameters<Parameters<typeof db.transaction>[0]>[0]
