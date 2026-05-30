import { useMemo, useRef, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import type { FieldRendererProps } from "../types"

export function JsonKind({ rhf }: FieldRendererProps) {
	const { value, onChange, onBlur } = rhf
	const [raw, setRaw] = useState<string>(() =>
		value === undefined
			? ""
			: typeof value === "string"
				? value
				: JSON.stringify(value, null, 2),
	)
	const lastValueRef = useRef(value)
	if (lastValueRef.current !== value) {
		lastValueRef.current = value
		const next =
			value === undefined
				? ""
				: typeof value === "string"
					? value
					: JSON.stringify(value, null, 2)
		if (next !== raw) setRaw(next)
	}

	const parsed = useMemo(() => {
		if (raw.trim() === "") return { ok: true as const }
		try {
			JSON.parse(raw)
			return { ok: true as const }
		} catch (e) {
			return { ok: false as const, error: (e as Error).message }
		}
	}, [raw])
	return (
		<div className="grid gap-1">
			<Textarea
				rows={3}
				className="font-mono text-xs"
				value={raw}
				onBlur={onBlur}
				onChange={(e) => {
					const next = e.target.value
					setRaw(next)
					if (next === "") return onChange(undefined)
					try {
						onChange(JSON.parse(next))
					} catch {
						// Keep the last parsed value while the user has an incomplete edit.
					}
				}}
			/>
			{!parsed.ok && (
				<p className="text-xs text-destructive">Invalid JSON: {parsed.error}</p>
			)}
		</div>
	)
}
