import type { Effect } from "@core/effects"

/**
 * Single dispatch surface for Effect values produced by pure code. Exhaustive
 * `switch (e.kind)` matches api-side dispatch style — one case today, trivially
 * extensible without touching producers. Runs sequentially; `Exit` aborts the
 * process, so any effects after it are implicitly dropped.
 */
export function commit(effects: Effect[]): void {
	for (const e of effects) {
		switch (e.kind) {
			case "Exit": {
				process.exit(e.code)
			}
		}
	}
}
