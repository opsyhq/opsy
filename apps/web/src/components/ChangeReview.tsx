import { useQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useMemo } from "react"
import { diffPaths } from "@/lib/changeDiff"
import { type ChangeSetItem, changesRecord } from "@/lib/changeSetReactQuery"
import { typeArtifactsQueryOptions } from "@/lib/providerReactQuery"
import { cn } from "@/lib/utils"
import { inferProviderFromType } from "./resource-sheet/shared"
import { operationKindColors } from "./StatusBadge"
import { Badge } from "./ui/badge"
import { Table, TableBody, TableCell, TableRow } from "./ui/table"

const CHANGE_KIND_LABEL: Record<ChangeSetItem["kind"], string> = {
	create_resource: "Create",
	update_resource: "Update",
	delete_resource: "Delete",
	import_resource: "Import",
}

const KIND_OP: Record<ChangeSetItem["kind"], string> = {
	create_resource: "create",
	update_resource: "update",
	delete_resource: "delete",
	import_resource: "import",
}

function kindToneClass(kind: ChangeSetItem["kind"]): string {
	return operationKindColors[KIND_OP[kind]] ?? operationKindColors.create
}

type ChangeSummary = {
	label: string
	detail: string
}

function changeResourceLabel(item: ChangeSetItem): string {
	if (item.targetResourceSlug) return item.targetResourceSlug
	const changes = changesRecord(item)
	return typeof changes.slug === "string" ? changes.slug : "Resource"
}

function getChangeSummary(item: ChangeSetItem): ChangeSummary {
	const changes = changesRecord(item)
	if (item.kind === "update_resource") {
		const parts = []
		if (changes.inputs !== undefined) parts.push("desired config")
		if (changes.position !== undefined) parts.push("layout position")
		return {
			label: changeResourceLabel(item),
			detail: parts.length > 0 ? parts.join(", ") : "metadata",
		}
	}
	if (item.kind === "delete_resource") {
		const mode =
			changes.mode === "forget" ? "remove tracking" : "destroy resource"
		return {
			label: changeResourceLabel(item),
			detail: mode,
		}
	}
	const type =
		typeof changes.type === "string" ? changes.type : item.resourceType
	return {
		label: changeResourceLabel(item),
		detail: type ? `managed resource - ${type}` : "managed resource",
	}
}

export function CompactChangeSummary({
	item,
	className,
	statusSlot,
	hideDetail,
}: {
	item: ChangeSetItem
	className?: string
	statusSlot?: ReactNode
	hideDetail?: boolean
}) {
	const summary = getChangeSummary(item)
	return (
		<div className={cn("min-w-0", className)}>
			<div className="flex items-center gap-2">
				<div className="min-w-0 shrink truncate font-mono text-sm">
					{summary.label}
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					<Badge variant="outline" className={kindToneClass(item.kind)}>
						{CHANGE_KIND_LABEL[item.kind]}
					</Badge>
					{statusSlot}
				</div>
			</div>
			{!hideDetail && (
				<div className="mt-1 truncate text-xs text-muted-foreground">
					{summary.detail}
				</div>
			)}
		</div>
	)
}

export function replacePathSet(
	requiresReplace: string[][] | null | undefined,
): Set<string> {
	if (!requiresReplace) return new Set()
	return new Set(requiresReplace.map((p) => p.join(".")))
}

export function useFieldLabels(resourceType: string | null) {
	const provider = resourceType ? inferProviderFromType(resourceType) : ""
	const { data } = useQuery(
		typeArtifactsQueryOptions({
			provider,
			type: resourceType ?? "",
			kind: "resource",
			enabled: !!provider && !!resourceType,
		}),
	)
	return useMemo(() => {
		const fieldMetadata = data?.fieldMetadata.data
		return (path: string) => fieldMetadata?.[path]?.label ?? path
	}, [data?.fieldMetadata.data])
}

export function FieldLevelDiff({
	before,
	after,
	resourceType,
	requiresReplace,
	className,
}: {
	before: unknown
	after: unknown
	resourceType?: string | null
	requiresReplace?: string[][] | null
	className?: string
}) {
	const labelFor = useFieldLabels(resourceType ?? null)
	const changes = useMemo(() => diffPaths(before, after), [before, after])
	const replaces = useMemo(
		() => replacePathSet(requiresReplace),
		[requiresReplace],
	)
	if (changes.length === 0) {
		return (
			<div className={cn("rounded border bg-muted/20 p-3 text-sm", className)}>
				No field-level differences.
			</div>
		)
	}
	return (
		<Table className={cn("text-xs", className)}>
			<TableBody>
				{changes.map((change) => (
					<TableRow key={change.path} className="hover:bg-transparent">
						<TableCell
							className="w-40 align-top text-muted-foreground"
							title={change.path}
						>
							<span className="inline-flex items-center gap-1.5">
								{replaces.has(change.path) && (
									<span
										role="img"
										className="inline-block size-1.5 shrink-0 rounded-full bg-[#E94957]"
										title="Changing this field forces a replace"
										aria-label="Forces replace"
									/>
								)}
								{labelFor(change.path)}
							</span>
						</TableCell>
						<TableCell className="align-top whitespace-normal">
							<DiffCell before={change.before} after={change.after} />
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	)
}

export function DiffCell({
	before,
	after,
}: {
	before: unknown
	after: unknown
}) {
	return (
		<div className="grid gap-0.5 font-mono text-xs">
			{before !== undefined && <DiffLine sign="-" value={before} />}
			{after !== undefined && <DiffLine sign="+" value={after} />}
		</div>
	)
}

function DiffLine({ sign, value }: { sign: "-" | "+"; value: unknown }) {
	return (
		<div className="flex items-start gap-2 rounded px-1.5 py-0.5">
			<span
				className={cn(
					"select-none text-base font-light leading-none",
					sign === "+" ? "text-emerald-500" : "text-[#E94957]",
				)}
			>
				{sign}
			</span>
			<span className="min-w-0 flex-1 whitespace-pre-wrap break-all">
				{formatValue(value)}
			</span>
		</div>
	)
}

function formatValue(value: unknown): string {
	if (value === null) return "null"
	if (value === undefined) return ""
	if (typeof value === "string") return value
	if (typeof value === "number" || typeof value === "boolean")
		return String(value)
	return JSON.stringify(value, null, 2)
}
