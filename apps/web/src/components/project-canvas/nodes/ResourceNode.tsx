import { useQuery } from "@tanstack/react-query"
import { Handle, type NodeProps, Position } from "@xyflow/react"
import { type CSSProperties, memo } from "react"
import { DryRunChip, isAlarmingDryRun } from "@/components/DryRunChip"
import {
	type ChangeSetItem,
	type DryRunAction,
	dryRunQueryOptions,
	type ResourceDryRun,
} from "@/lib/changeSetReactQuery"
import { typeArtifactsQueryOptions } from "@/lib/providerReactQuery"
import { useCanvasContext } from "../canvasContext"
import { MAX_VISIBLE_TOP_EDGE_ITEMS, statusToneClass } from "../nodeFootprint"
import { ResourceNodeHeader } from "./ResourceNodeHeader"

export type ResourceInputNode = {
	key: string
}

export type ResourceNodeItem = {
	slug: string
	type: string
	label: string
}

type ResourceDisplay = "card" | "compact" | "chip"

export type ResourceNodeNestedItem = ResourceNodeItem & {
	display?: ResourceDisplay
	topEdgeItems?: ResourceNodeNestedItem[]
	bottomTuckedItems?: ResourceNodeNestedItem[]
}

export type ResourceNodeData = {
	slug: string
	resourceLabel: string
	type: string
	provider: string | null
	status: string
	inputs: ResourceInputNode[]
	staged?: boolean
	stageItemId?: string
	stageKind?: ChangeSetItem["kind"]
	stageAction?: string
	dryRunInitial?: ResourceDryRun | null
	topEdgeItems?: ResourceNodeNestedItem[]
	display?: ResourceDisplay
	dropTargetActive?: boolean
	layout?: {
		bodyHeight: number
		topEdgeHeight: number
		bottomTuckedOverlap: number
	}
}

function ResourceNodeImpl({
	data,
	onOpenResource,
}: NodeProps & {
	data: ResourceNodeData
	onOpenResource?: (slug: string) => void
}) {
	const canvas = useCanvasContext()
	const { data: dryRun = null } = useQuery(
		dryRunQueryOptions({
			projectSlug: canvas.projectSlug,
			changeSetId: canvas.changeSetId ?? "",
			itemId: data.stageItemId ?? "",
			initialData: data.dryRunInitial,
			enabled: !!(data.staged && data.stageItemId && canvas.changeSetId),
		}),
	)
	const { data: artifacts = null } = useQuery({
		...typeArtifactsQueryOptions({
			provider: data.provider ?? "",
			type: data.type,
			kind: "resource",
		}),
		enabled: !!data.provider && !!data.type,
	})
	const typeLabel =
		artifacts?.metadata.data?.name ?? (data.provider ? data.type : "Resource")
	const fieldMetadata =
		artifacts?.fieldMetadata.status === "ready"
			? artifacts.fieldMetadata.data
			: null
	const visibleInputs = fieldMetadata
		? data.inputs.filter((input) => fieldMetadata[input.key]?.core === true)
		: data.inputs
	const dryRunAction: DryRunAction | null = dryRun?.action ?? null
	const description = typeLabel
	const stagedDescription =
		data.stageAction ?? STAGED_DESCRIPTION[data.stageKind ?? ""] ?? description
	const stagedDelete = data.stageKind === "delete_resource"
	const severity = stagedSeverity({
		staged: !!data.staged,
		stagedDelete,
		dryRunAction,
	})
	const style = SEVERITY_STYLES[severity]
	const previewClass = style.previewClass
	const stagedShadow = style.shadow
	const effectiveTone = style.tone ?? statusToneClass(data.status)
	const statusText = stagedDelete
		? (data.stageAction?.toLowerCase() ?? "delete staged")
		: data.status
	const detailTitle = data.staged ? stagedDescription : description
	const topEdgeItems = data.topEdgeItems ?? []
	const display = data.display ?? "card"
	const isChip = display === "chip"
	const cardTop = data.layout?.topEdgeHeight ?? 0
	const bodyHeight = data.layout?.bodyHeight
	const cardStyle: CSSProperties =
		bodyHeight === undefined
			? { inset: 0 }
			: {
					top: cardTop,
					height: bodyHeight,
				}
	const showDryRunChip = isAlarmingDryRun(dryRun)
	return (
		<div className="pointer-events-none relative box-border h-full w-full overflow-visible text-xs">
			<div
				className={`opsy-resource-card pointer-events-auto absolute right-0 left-0 z-10 box-border overflow-hidden rounded-lg border bg-canvas-bg transition-colors ${previewClass}`}
				style={{
					...cardStyle,
					boxShadow:
						data.staged && stagedShadow
							? stagedShadow
							: "0 4px 12px rgba(0, 0, 0, 0.35)",
				}}
			>
				<Handle
					type="target"
					position={Position.Top}
					className="!size-2 !border-0 !bg-transparent"
					style={{ left: "50%" }}
				/>
				<Handle
					type="source"
					position={Position.Bottom}
					className="!size-2 !border-0 !bg-transparent"
					style={{ left: "50%" }}
				/>
				<ResourceNodeHeader
					data={data}
					icon={artifacts?.icon}
					metadataStatus={artifacts?.metadata.status}
					trailing={null}
					showHandles={false}
					dense={isChip}
				/>
				{!isChip && (
					<>
						<InputHandles inputs={visibleInputs} />
						<div className="relative h-10 px-2.5">
							<div
								className="-mt-1 min-h-4 truncate text-[10px] leading-4 text-canvas-muted"
								title={detailTitle}
							>
								{detailTitle}
							</div>
							{showDryRunChip && (
								<div className="absolute bottom-2.5 left-2.5">
									<DryRunChip
										dryRun={dryRun}
										className="text-[9px] leading-none"
									/>
								</div>
							)}
							<div className="absolute right-2.5 bottom-2.5 flex min-w-0 items-center gap-1">
								<span
									className={`size-2 shrink-0 rounded-full ${effectiveTone}`}
								/>
								<span className="truncate font-mono text-[10px] leading-none text-canvas-muted">
									{statusText}
								</span>
							</div>
						</div>
					</>
				)}
			</div>
			{!isChip && (
				<TopEdgeNotes
					items={topEdgeItems}
					onOpenResource={onOpenResource}
					style={{ top: cardTop }}
				/>
			)}
		</div>
	)
}

export function TopEdgeNotes({
	items,
	onOpenResource,
	style,
}: {
	items: ResourceNodeNestedItem[]
	onOpenResource?: (slug: string) => void
	style?: CSSProperties
}) {
	if (items.length === 0) return null
	const visible = items.slice(0, MAX_VISIBLE_TOP_EDGE_ITEMS)
	const overflow = items.length - visible.length
	return (
		<div
			className="pointer-events-auto absolute top-0 right-2 left-8 z-20 flex -translate-y-1/2 items-center gap-1 overflow-hidden"
			style={style}
		>
			{visible.map((item) => (
				<button
					key={item.slug}
					type="button"
					className={`max-w-24 truncate rounded-[3px] border border-canvas-border bg-canvas-surface px-1.5 py-0.5 text-[9px] font-medium leading-none text-canvas-muted shadow-sm ${
						onOpenResource
							? "cursor-pointer hover:border-canvas-border-hover hover:text-canvas-fg"
							: "cursor-default"
					}`}
					onPointerDown={(event) => event.stopPropagation()}
					onClick={(event) => {
						event.preventDefault()
						event.stopPropagation()
						onOpenResource?.(item.slug)
					}}
					title={`${item.slug} (${item.type})`}
				>
					{item.label}
				</button>
			))}
			{overflow > 0 && (
				<span className="rounded-[3px] border border-canvas-border bg-canvas-surface px-1.5 py-0.5 text-[9px] font-medium leading-none text-canvas-muted">
					+{overflow}
				</span>
			)}
		</div>
	)
}

function InputHandles({ inputs }: { inputs: ResourceInputNode[] }) {
	if (inputs.length === 0) return null
	return (
		<>
			{inputs.map((input, index) => (
				<Handle
					key={input.key}
					type="target"
					position={Position.Top}
					id={input.key}
					className="!size-2 !border-0 !bg-transparent"
					style={{
						left:
							inputs.length === 1
								? "50%"
								: `calc(24px + ${(index / (inputs.length - 1)) * 100}% - ${
										(48 * index) / (inputs.length - 1)
									}px)`,
					}}
				/>
			))}
		</>
	)
}

type StagedSeverity = "danger" | "pending" | "muted" | "neutral" | "none"

const STAGED_DESCRIPTION: Record<string, string> = {
	import_resource: "Import preview",
	create_resource: "Create preview",
}

const SEVERITY_STYLES: Record<
	StagedSeverity,
	{ previewClass: string; shadow: string | undefined; tone: string | null }
> = {
	danger: {
		previewClass:
			"border-canvas-err/80 bg-canvas-err/10 hover:border-canvas-err",
		shadow: "0 0 0 1px hsl(1 62% 44% / 0.35)",
		tone: "bg-canvas-err",
	},
	pending: {
		previewClass:
			"border-green-500/80 bg-green-500/10 hover:border-green-400 animate-pulse",
		shadow: "0 0 0 1px rgb(34 197 94 / 0.35)",
		tone: "bg-canvas-warn",
	},
	muted: {
		previewClass:
			"border-canvas-muted/60 bg-canvas-muted/5 hover:border-canvas-muted",
		shadow: "0 0 0 1px rgb(120 120 120 / 0.25)",
		tone: "bg-canvas-muted",
	},
	neutral: {
		previewClass: "border-green-500/80 bg-green-500/10 hover:border-green-400",
		shadow: "0 0 0 1px rgb(34 197 94 / 0.35)",
		tone: null,
	},
	none: {
		previewClass: "border-[#2C2C2C]",
		shadow: undefined,
		tone: null,
	},
}

function stagedSeverity({
	staged,
	stagedDelete,
	dryRunAction,
}: {
	staged: boolean
	stagedDelete: boolean
	dryRunAction: DryRunAction | null
}): StagedSeverity {
	if (!staged) return "none"
	if (dryRunAction === "error") return "danger"
	if (stagedDelete) return "danger"
	if (dryRunAction === "replace" || dryRunAction === "delete") return "danger"
	if (dryRunAction === "pending") return "pending"
	if (dryRunAction === "deferred" || dryRunAction === "noop") return "muted"
	return "neutral"
}

export const ResourceNode = memo(ResourceNodeImpl)
