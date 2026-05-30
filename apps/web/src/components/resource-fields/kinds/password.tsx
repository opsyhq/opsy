import { ResourcePicker } from "@/components/resource-picker"
import type { FieldRendererProps } from "../types"

export function PasswordKind({ rhf }: FieldRendererProps) {
	return (
		<ResourcePicker
			type="password"
			value={rhf.value}
			onChange={rhf.onChange}
			onBlur={rhf.onBlur}
		/>
	)
}
