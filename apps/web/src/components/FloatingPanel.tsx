import { X } from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Rnd } from "react-rnd"
import { PANEL_EDGE_INSET } from "@/components/layout/railWidths"
import { cn } from "@/lib/utils"

const MIN_WIDTH = 320
const DEFAULT_WIDTH = 512
const DEFAULT_HEIGHT_HINT = 520
const EDGE_INSET = PANEL_EDGE_INSET

type Placement = "top-right" | "center"

export function FloatingPanel({
	open,
	onClose,
	title,
	subtitle,
	headerRight,
	defaultWidth = DEFAULT_WIDTH,
	defaultHeight,
	defaultHeightHint = DEFAULT_HEIGHT_HINT,
	minWidth = MIN_WIDTH,
	maxWidth,
	rightOffset = 0,
	leftOffset = 0,
	topOffset = 0,
	bottomOffset = 0,
	placement = "top-right",
	disableDragging = false,
	panelClassName,
	headerClassName,
	dividerClassName,
	bodyClassName,
	closeButtonClassName,
	children,
}: {
	open: boolean
	onClose: () => void
	title: React.ReactNode
	subtitle?: React.ReactNode
	headerRight?: React.ReactNode
	defaultWidth?: number
	defaultHeight?: number | "fill"
	defaultHeightHint?: number
	minWidth?: number
	maxWidth?: number
	rightOffset?: number
	leftOffset?: number
	topOffset?: number
	bottomOffset?: number
	placement?: Placement
	disableDragging?: boolean
	panelClassName?: string
	headerClassName?: string
	dividerClassName?: string
	bodyClassName?: string
	closeButtonClassName?: string
	children: React.ReactNode
}) {
	const [resetKey, setResetKey] = useState(0)

	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [open, onClose])

	if (!open) return null
	if (typeof document === "undefined") return null

	const defaultPos =
		placement === "center"
			? {
					x: Math.max(
						EDGE_INSET,
						leftOffset +
							(window.innerWidth - leftOffset - rightOffset - defaultWidth) / 2,
					),
					y: Math.max(EDGE_INSET, (window.innerHeight - defaultHeightHint) / 2),
				}
			: {
					x: Math.max(
						EDGE_INSET,
						window.innerWidth - defaultWidth - EDGE_INSET - rightOffset,
					),
					y: EDGE_INSET + topOffset,
				}
	const maxH = window.innerHeight - defaultPos.y - EDGE_INSET - bottomOffset
	const resolvedHeight =
		defaultHeight === "fill"
			? maxH
			: typeof defaultHeight === "number"
				? defaultHeight
				: "auto"

	return createPortal(
		<Rnd
			key={resetKey}
			default={{
				x: defaultPos.x,
				y: defaultPos.y,
				width: defaultWidth,
				height: resolvedHeight,
			}}
			bounds="window"
			minWidth={minWidth}
			maxWidth={maxWidth}
			maxHeight={maxH}
			disableDragging={disableDragging}
			dragHandleClassName="fp-handle"
			cancel="button"
			enableResizing={{
				top: false,
				right: true,
				bottom: false,
				left: true,
				topRight: false,
				bottomRight: false,
				bottomLeft: false,
				topLeft: false,
			}}
			className={cn(
				"z-50 overflow-hidden rounded-[10px] border border-border bg-background shadow-2xl outline-none focus:outline-none focus-visible:outline-none",
				panelClassName,
			)}
			role="dialog"
			aria-label={typeof title === "string" ? title : undefined}
		>
			<div
				className="flex h-full max-h-full flex-col"
				style={{ maxHeight: maxH }}
			>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: react-rnd drag handle; double-click-to-reset is a progressive enhancement, dragging is the primary affordance and the panel itself carries role="dialog". */}
				<div
					className={cn(
						"fp-handle flex shrink-0 touch-none select-none items-center justify-between gap-3 px-4 pt-4 pb-3",
						!disableDragging && "cursor-grab active:cursor-grabbing",
						headerClassName,
					)}
					onDoubleClick={(e) => {
						if (disableDragging) return
						if ((e.target as HTMLElement).closest("button")) return
						setResetKey((k) => k + 1)
					}}
				>
					<div className="min-w-0 flex-1">
						<h3 className="truncate text-base font-semibold">{title}</h3>
						{subtitle && (
							<div className="mt-0.5 truncate text-xs text-muted-foreground">
								{subtitle}
							</div>
						)}
					</div>
					<div className="flex shrink-0 items-center gap-2">
						{headerRight}
						<button
							type="button"
							onClick={onClose}
							aria-label="Close"
							className={cn(
								"p-1 text-muted-foreground hover:text-foreground",
								closeButtonClassName,
							)}
						>
							<X className="size-4" />
						</button>
					</div>
				</div>
				<div className={cn("border-b border-border", dividerClassName)} />
				<div
					className={cn(
						"scrollbar-thin min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto pt-3",
						bodyClassName,
					)}
				>
					{children}
				</div>
			</div>
		</Rnd>,
		document.body,
	)
}
