import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { FieldRendererProps } from "../types"

export function BoolKind({ rhf }: FieldRendererProps) {
	const { value, onChange, onBlur } = rhf
	const sel = value === true ? "true" : value === false ? "false" : ""
	return (
		<Select
			value={sel}
			onValueChange={(v) =>
				onChange(v === "true" ? true : v === "false" ? false : undefined)
			}
		>
			<SelectTrigger className="w-full" onBlur={onBlur}>
				<SelectValue placeholder="Unset" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="true">true</SelectItem>
				<SelectItem value="false">false</SelectItem>
			</SelectContent>
		</Select>
	)
}
