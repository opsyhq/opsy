import { Input } from "@/components/ui/input"
import type { FieldRendererProps } from "../types"

export function NumberKind({ rhf }: FieldRendererProps) {
	const { value, onChange, onBlur } = rhf
	return (
		<Input
			type="number"
			value={value == null ? "" : String(value)}
			onBlur={onBlur}
			onChange={(e) => {
				const raw = e.target.value
				if (raw === "") return onChange(undefined)
				const n = Number(raw)
				onChange(Number.isNaN(n) ? raw : n)
			}}
		/>
	)
}
