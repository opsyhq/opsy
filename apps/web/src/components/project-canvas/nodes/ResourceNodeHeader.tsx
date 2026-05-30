import { Handle, Position } from "@xyflow/react"
import { Loader2 } from "lucide-react"
import { ResourceTypeIconForType } from "@/components/ResourceTypeIcon"
import { getProviderMeta } from "@/lib/providerMeta"
import type {
	ThinkingBlockArtifactStatus,
	TypeIconLookup,
} from "@/lib/providerReactQuery"
import { statusToneClass } from "../nodeFootprint"
import type { ResourceNodeData } from "./ResourceNode"

type ResourceNodeHeaderProps = {
	data: ResourceNodeData
	icon?: TypeIconLookup | null
	metadataStatus?: ThinkingBlockArtifactStatus | null
	collapseChevron?: React.ReactNode
	trailing?: React.ReactNode
	showHandles?: boolean
	showStatus?: boolean
	dense?: boolean
}

export function ResourceNodeHeader({
	data,
	icon,
	metadataStatus,
	collapseChevron,
	trailing,
	showHandles = true,
	showStatus = false,
	dense = false,
}: ResourceNodeHeaderProps) {
	const tone = statusToneClass(data.status)
	const providerMeta = data.provider
		? getProviderMeta(data.provider)
		: { id: "resource", name: "Resource", short: "RES", color: "#64748b" }
	const showMetadataLoading =
		metadataStatus === "pending" || metadataStatus === "running"
	const displayTitle = data.resourceLabel
	const title =
		data.resourceLabel === data.slug
			? data.slug
			: `${data.resourceLabel} (${data.slug})`

	return (
		<div
			className={
				dense
					? "relative grid h-full grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-1.5 px-2"
					: "relative grid h-10 grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-2 px-2.5 pb-1"
			}
		>
			{showHandles && (
				<Handle
					type="source"
					position={Position.Bottom}
					className="!size-2 !border-0 !bg-transparent"
					style={{ left: "50%" }}
				/>
			)}
			<ResourceTypeIconForType
				provider={providerMeta}
				type={data.provider ? data.type : undefined}
				icon={icon ?? undefined}
				size="sm"
				spinnerSurfaceClassName="bg-canvas-surface"
				spinnerClassName="text-canvas-muted"
			/>
			<span
				className={
					dense
						? "min-w-0 truncate text-[11px] font-medium leading-none text-canvas-fg"
						: "min-w-0 truncate text-[12px] font-medium leading-none text-canvas-fg"
				}
				title={title}
			>
				{displayTitle}
			</span>
			{showMetadataLoading && (
				<Loader2
					className="size-3 shrink-0 animate-spin text-canvas-muted"
					aria-label="Loading type metadata"
				/>
			)}
			{trailing}
			{showStatus && (
				<span
					className={`size-1.5 shrink-0 rounded-full ${tone}`}
					aria-hidden
				/>
			)}
			{collapseChevron}
		</div>
	)
}
