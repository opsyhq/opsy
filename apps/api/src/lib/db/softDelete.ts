import { NotFound } from "@opsy/contracts/errors"
import { and, isNull, type SQL } from "drizzle-orm"
import type {
	AnyPgColumn,
	PgTable,
	PgUpdateSetSource,
} from "drizzle-orm/pg-core"
import type { Executor } from "./client"

// Uniform `--force` semantics for CLI soft-deletes — same contract as `rm -f`:
// without force, a missing or tombstoned row raises 404; with force, it's a
// no-op. Callers own the deps-guard bypass (skip their 409 check under force);
// this helper owns the idempotency. The `isNull(deletedAt)` filter is baked in
// so a re-run doesn't rewrite `deletedAt` on tombstoned rows.
interface SoftDeleteOptions<T extends PgTable & { deletedAt: AnyPgColumn }> {
	tx: Executor
	table: T
	where: SQL
	force: boolean
	notFoundMessage?: string
	// Extra columns to set alongside `deletedAt` (e.g. resources set status="deleted").
	extraSet?: PgUpdateSetSource<T>
}

export async function softDeleteOne<
	T extends PgTable & { deletedAt: AnyPgColumn },
>(opts: SoftDeleteOptions<T>): Promise<{ deleted: boolean }> {
	const where = and(opts.where, isNull(opts.table.deletedAt))!
	const rows = await opts.tx
		.update(opts.table)
		.set({
			deletedAt: new Date(),
			...(opts.extraSet ?? {}),
		} as PgUpdateSetSource<T>)
		.where(where)
		.returning()
	if (rows.length > 0) return { deleted: true }
	if (opts.force) return { deleted: false }
	throw new NotFound({ detail: opts.notFoundMessage ?? "not found" })
}
