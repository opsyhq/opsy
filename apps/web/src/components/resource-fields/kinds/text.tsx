import { ResourcePicker } from "@/components/resource-picker"
import type { FieldRendererProps } from "../types"

export function TextKind({
	rhf,
	referenceAutocomplete,
	referenceCandidates,
	referencesLoading,
	onReferenceSelect,
	relationship,
}: FieldRendererProps) {
	const autocomplete =
		referenceAutocomplete ??
		(referenceCandidates
			? {
					candidates: referenceCandidates,
					isLoading: referencesLoading,
					onSelect: onReferenceSelect,
				}
			: undefined)
	return (
		<ResourcePicker
			type="text"
			value={rhf.value}
			onChange={rhf.onChange}
			onBlur={rhf.onBlur}
			referenceAutocomplete={autocomplete}
			relationship={relationship}
		/>
	)
}
