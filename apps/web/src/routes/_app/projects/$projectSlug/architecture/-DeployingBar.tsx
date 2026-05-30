import { useSuspenseQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Fragment, useEffect, useMemo, useState } from "react"
import {
	itemPhase,
	itemSlug,
} from "@/components/project-canvas/changeSetCanvas"
import {
	type ChangeSetItemRunningPhase,
	isRunningPhase,
} from "@/components/project-canvas/changeSetRuntime"
import {
	activeChangeSetQueryOptions,
	type ChangeSet,
	type ChangeSetItem,
} from "@/lib/changeSetReactQuery"
import {
	type ProjectOpenOperation,
	projectOperationsQueryOptions,
} from "@/lib/projectReactQuery"

const SHORT_ID_LENGTH = 8

export function DeployingBars({ projectSlug }: { projectSlug: string }) {
	const { data } = useSuspenseQuery(
		activeChangeSetQueryOptions({ projectSlug }),
	)
	const { data: opsData } = useSuspenseQuery(
		projectOperationsQueryOptions({ slug: projectSlug }),
	)
	const opsByItemId = useMemo(() => {
		const m = new Map<string, ProjectOpenOperation>()
		for (const op of opsData.operations) {
			if (op.closedAt || !op.changeSetItemId) continue
			m.set(op.changeSetItemId, op)
		}
		return m
	}, [opsData.operations])

	if (data.applying.length === 0) return null
	return (
		<div className="pointer-events-none absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
			{data.applying.map((cs) => (
				<DeployingBar key={cs.id} changeSet={cs} opsByItemId={opsByItemId} />
			))}
		</div>
	)
}

function DeployingBar({
	changeSet,
	opsByItemId,
}: {
	changeSet: ChangeSet
	opsByItemId: Map<string, ProjectOpenOperation>
}) {
	const now = useNow()

	const tally = useMemo(
		() => tallyItems(changeSet.items, opsByItemId),
		[changeSet.items, opsByItemId],
	)
	const { running, pending, done, failed, runningRows } = tally
	// `changeSet.updatedAt` is the apply-start proxy: the server stamps it when
	// status flips to "applying" and doesn't touch it again during the run.
	const csStartMs = useMemo(
		() => parseTime(changeSet.updatedAt),
		[changeSet.updatedAt],
	)
	const csElapsed = formatElapsed(now - csStartMs)

	return (
		<div className="pointer-events-auto w-[420px] max-w-[90vw] rounded-lg border bg-background px-4 py-3 shadow-lg">
			<div className="flex items-center gap-2.5">
				<Loader2 className="size-4 shrink-0 animate-spin" />
				<span className="text-sm font-medium leading-none">Deploying</span>
				<span className="ml-auto text-xs tabular-nums text-muted-foreground">
					{csElapsed}
				</span>
			</div>
			<div className="mt-2.5 flex items-center gap-4 text-xs tabular-nums text-muted-foreground">
				<CountStat n={running} label="running" />
				<CountStat n={pending} label="pending" />
				<CountStat n={done} label="done" />
				{failed > 0 && (
					<CountStat n={failed} label="failed" tone="destructive" />
				)}
			</div>
			{runningRows.length > 0 && (
				<div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-5 gap-y-1.5 border-t pt-2.5 text-xs">
					{runningRows.map(({ item, startMs, verb }) => (
						<Fragment key={item.id}>
							<span className="truncate font-mono">
								{itemSlug(item) ?? item.id.slice(0, SHORT_ID_LENGTH)}
							</span>
							<span className="text-muted-foreground capitalize">{verb}</span>
							<span className="text-right tabular-nums text-muted-foreground">
								{formatElapsed(now - startMs)}
							</span>
						</Fragment>
					))}
				</div>
			)}
		</div>
	)
}

function CountStat({
	n,
	label,
	tone,
}: {
	n: number
	label: string
	tone?: "destructive"
}) {
	return (
		<span className="flex items-baseline gap-1">
			<span
				className={
					tone === "destructive"
						? "font-medium text-destructive"
						: "font-medium text-foreground"
				}
			>
				{n}
			</span>
			<span>{label}</span>
		</span>
	)
}

type RunningRow = {
	item: ChangeSetItem
	startMs: number
	verb: ChangeSetItemRunningPhase
}

type Tally = {
	running: number
	pending: number
	done: number
	failed: number
	runningRows: RunningRow[]
}

export function tallyItems(
	items: ChangeSetItem[],
	opsByItemId: Map<string, ProjectOpenOperation>,
): Tally {
	let running = 0
	let pending = 0
	let done = 0
	let failed = 0
	const runningRows: RunningRow[] = []
	for (const item of items) {
		const op = opsByItemId.get(item.id) ?? null
		const phase = itemPhase(item, op)
		if (isRunningPhase(phase)) {
			running += 1
			if (op)
				runningRows.push({
					item,
					startMs: parseTime(op.updatedAt),
					verb: phase,
				})
		} else if (phase === "pending" || phase === "staged") {
			pending += 1
		} else if (phase === "done") {
			done += 1
		} else if (phase === "failed" || phase === "canceled") {
			failed += 1
		}
	}
	return { running, pending, done, failed, runningRows }
}

function useNow(): number {
	const [now, setNow] = useState(() => Date.now())
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(id)
	}, [])
	return now
}

function parseTime(iso: string): number {
	return new Date(iso).getTime()
}

export function formatElapsed(ms: number): string {
	if (!Number.isFinite(ms)) return "0s"
	const total = Math.max(0, Math.floor(ms / 1000))
	if (total < 60) return `${total}s`
	const m = Math.floor(total / 60)
	const s = total % 60
	return `${m}m ${s.toString().padStart(2, "0")}s`
}
