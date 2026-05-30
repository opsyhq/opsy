import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { RelationshipFlowSelection } from "./toFlowEdges"

export function RelationshipEdgeInspector({
	relationship,
	onOpenResource,
	onClose,
}: {
	relationship: RelationshipFlowSelection | null
	onOpenResource: (slug: string) => void
	onClose: () => void
}) {
	if (!relationship) return null
	const { edge, hiddenResourceSlugs, underlyingEdgeIds } = relationship
	const rows = [
		["Evidence", edge.origin === "rule" ? "Rule" : "Config"],
		["Role", edge.role],
		["Source", edge.source],
		["Target", edge.target],
		["Source path", edge.sourcePath === "$" ? null : edge.sourcePath],
		["Target path", edge.targetPath === "$" ? null : edge.targetPath],
		["Rule key", edge.ruleKey],
		["Edge ids", underlyingEdgeIds.join(", ")],
		["Hidden", hiddenResourceSlugs.join(", ")],
	].filter((row): row is [string, string] => Boolean(row[1]))

	return (
		<div className="pointer-events-auto absolute bottom-4 left-4 z-10 max-h-[calc(100%-2rem)] w-[min(420px,calc(100%-2rem))] overflow-y-auto rounded-lg border border-canvas-border bg-canvas-surface text-canvas-fg shadow-xl shadow-black/35">
			<div className="flex items-start justify-between gap-3 border-canvas-border border-b px-4 py-3">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="outline" className="border-canvas-border">
							{edge.role}
						</Badge>
						<Badge variant="secondary">
							{edge.origin === "rule" ? "Rule" : "Config"}
						</Badge>
					</div>
					<div className="mt-2 truncate text-sm font-semibold">
						{edge.source} to {edge.target}
					</div>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-7 shrink-0 text-canvas-muted hover:text-canvas-fg"
					onClick={onClose}
				>
					<X className="size-4" />
				</Button>
			</div>
			<div className="space-y-4 px-4 py-3">
				<div className="space-y-2">
					{rows.map(([label, value]) => (
						<div
							className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3"
							key={label}
						>
							<div className="font-medium text-[10px] text-canvas-muted uppercase">
								{label}
							</div>
							<div className="min-w-0 break-words text-canvas-fg text-xs">
								{value}
							</div>
						</div>
					))}
				</div>
				{hiddenResourceSlugs.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{hiddenResourceSlugs.map((slug) => (
							<Button
								key={slug}
								type="button"
								variant="outline"
								size="sm"
								className="h-7 border-canvas-border text-xs"
								onClick={() => onOpenResource(slug)}
							>
								Open {slug}
							</Button>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
