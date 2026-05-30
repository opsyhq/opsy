import type { ResolvedField } from "@/components/resource-detail/resolvedTypeView"
import { ResourcePickerMulti } from "@/components/resource-picker"
import { FIELD_KIND_REGISTRY } from "./registry"
import {
	isInlineBlock,
	type ResourceFieldInput,
	resolveResourceFieldInput,
	resourceFieldCollectionKind,
	resourceFieldValueWidgetKind,
} from "./resourceFieldInput"
import type { FieldKind, FieldRendererProps } from "./types"

// Resolve the registry key for a field. Structural shapes (inline group,
// array-of-objects, map-of-objects) win over the value-widget kind so the
// json branch stays for opaque schemaless JSON only.
export function resolveFieldKind(
	field: ResolvedField,
	input: ResourceFieldInput = resolveResourceFieldInput(field),
): FieldKind {
	if (input.kind === "field-group") return "object"
	const hasChildren = (field.children?.length ?? 0) > 0
	if (hasChildren) {
		const collection = resourceFieldCollectionKind(field)
		if (collection === "array") return "object-array"
		if (collection === "map") return "object-map"
		if (
			isInlineBlock(field) ||
			(field.kind === "attribute" &&
				Array.isArray(field.tfType) &&
				field.tfType[0] === "object")
		) {
			return "object"
		}
	}
	return resourceFieldValueWidgetKind(input)
}

export function FieldRenderer({
	field,
	kind,
	rhf,
	referenceAutocomplete,
	referenceCandidates,
	referencesLoading,
	onReferenceSelect,
	relationship,
	buildRelationship,
	sourcePath,
}: FieldRendererProps & { kind: FieldKind }) {
	if (relationship && relationship.relationship.cardinality === "many") {
		return (
			<ResourcePickerMulti
				field={field}
				value={rhf.value}
				onChange={rhf.onChange}
				onBlur={rhf.onBlur}
				relationship={relationship}
				referenceAutocomplete={
					referenceAutocomplete ??
					(referenceCandidates
						? {
								candidates: referenceCandidates,
								isLoading: referencesLoading,
								onSelect: onReferenceSelect,
							}
						: undefined)
				}
			/>
		)
	}
	const entry = FIELD_KIND_REGISTRY[kind]
	const { Renderer } = entry
	return (
		<Renderer
			field={field}
			rhf={rhf}
			referenceAutocomplete={referenceAutocomplete}
			referenceCandidates={referenceCandidates}
			referencesLoading={referencesLoading}
			onReferenceSelect={onReferenceSelect}
			relationship={relationship}
			buildRelationship={buildRelationship}
			sourcePath={sourcePath}
		/>
	)
}
