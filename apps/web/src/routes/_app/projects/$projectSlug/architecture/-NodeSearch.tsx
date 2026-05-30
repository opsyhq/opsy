import { useReactFlow } from "@xyflow/react"
import { Search } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { RESOURCE_NODE_SIZE } from "@/components/project-canvas/canvasConstants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type SearchableResource = {
	slug: string
	type: string
	position?: { x: number; y: number } | null
	size?: { w: number; h: number } | null
}

export function NodeSearch({ resources }: { resources: SearchableResource[] }) {
	const { fitBounds } = useReactFlow()
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState("")
	const inputRef = useRef<HTMLInputElement>(null)
	const wrapRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (open) inputRef.current?.focus()
	}, [open])

	useEffect(() => {
		if (!open) return
		const onDocDown = (e: PointerEvent) => {
			const target = e.target as globalThis.Node | null
			if (wrapRef.current && target && !wrapRef.current.contains(target)) {
				setOpen(false)
				setQuery("")
			}
		}
		document.addEventListener("pointerdown", onDocDown)
		return () => document.removeEventListener("pointerdown", onDocDown)
	}, [open])

	const positioned = useMemo(
		() => resources.filter((r) => !!r.position),
		[resources],
	)

	const focusResource = useCallback(
		(slug: string) => {
			const r = positioned.find((res) => res.slug === slug)
			if (!r?.position) return
			const w = r.size?.w ?? RESOURCE_NODE_SIZE.w
			const h = r.size?.h ?? RESOURCE_NODE_SIZE.h
			void fitBounds(
				{
					x: r.position.x - w,
					y: r.position.y - h,
					width: w * 3,
					height: h * 3,
				},
				{ duration: 400 },
			)
		},
		[positioned, fitBounds],
	)

	const submit = () => {
		const q = query.trim().toLowerCase()
		if (!q) return
		const match =
			positioned.find((r) => r.slug.toLowerCase() === q) ??
			positioned.find((r) => r.slug.toLowerCase().startsWith(q)) ??
			positioned.find((r) => r.slug.toLowerCase().includes(q)) ??
			positioned.find((r) => r.type.toLowerCase().includes(q))
		if (match) {
			focusResource(match.slug)
			setOpen(false)
			setQuery("")
		}
	}

	return (
		<div ref={wrapRef} className="flex items-center gap-2">
			<div
				className="overflow-hidden transition-[width] duration-200 ease-out"
				style={{ width: open ? 224 : 0 }}
			>
				<Input
					ref={inputRef}
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault()
							submit()
						} else if (e.key === "Escape") {
							setOpen(false)
							setQuery("")
						}
					}}
					tabIndex={open ? 0 : -1}
					placeholder="Search resources..."
					className="h-8 w-56 rounded-lg bg-canvas-bg transition-opacity duration-150 ease-out focus-visible:border-input focus-visible:ring-0 dark:bg-canvas-bg"
					style={{
						opacity: open ? 1 : 0,
						transitionDelay: open ? "120ms" : "0ms",
					}}
				/>
			</div>
			<Button
				size="icon-sm"
				variant="outline"
				aria-label="Search resources"
				title="Search resources"
				onClick={() => setOpen((v) => !v)}
				className="border bg-canvas-bg hover:bg-canvas-bg dark:bg-canvas-bg dark:hover:bg-canvas-bg"
			>
				<Search className="size-3.5" />
			</Button>
		</div>
	)
}
