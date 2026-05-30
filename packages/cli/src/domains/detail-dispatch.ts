import type { HandlerDeps } from "@core/types/deps"
import { runAction } from "@shell/run-action"
import type { DescribeOpts } from "../verbs/describe/handlers"
import type { GetOpts } from "../verbs/get/handlers"

// `opsy <noun> get` prints the summary payload; `--detail` (and the hidden
// `describe` alias, which forces it) swaps in the rich rendered view. Every
// noun with both views wires its summary/detail handler pair through here so
// the dispatch lives in one place instead of three copies.
export type DetailOpts = GetOpts & DescribeOpts & { detail?: boolean }

type View = (
	deps: HandlerDeps,
	target: string,
	opts: DetailOpts,
) => Promise<void>

export const detailDispatch =
	(summary: View, detail: View) => (forceDetail: boolean) =>
		runAction(async (d, target: string, opts: DetailOpts) =>
			forceDetail || opts.detail
				? detail(d, target, opts)
				: summary(d, target, opts),
		)
