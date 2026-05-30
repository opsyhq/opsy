import type { ComponentType } from "react"
import type { ResolvedField } from "@/components/resource-detail/resolvedTypeView"
import type { RelatedCreateTargetEndpoint } from "@/lib/relatedResourceCreate"
import type { ResourceReferenceCandidate } from "@/lib/resourceRefs"
import type {
	PickerRelationship,
	ResourceFieldWidgetKind,
} from "./resourceFieldInput"

export type WidgetControl = {
	value: unknown
	onChange: (v: unknown) => void
	onBlur: () => void
}

export type ReferenceAutocomplete = {
	candidates: readonly ResourceReferenceCandidate[]
	isLoading?: boolean
	onSelect?: (ref: string) => void
}

export type RelationshipPlumbing = {
	relationship: PickerRelationship
	candidates: readonly ResourceReferenceCandidate[]
	isLoading: boolean
	isError: boolean
	createTargets: readonly RelatedCreateTargetEndpoint[]
	onCreateTarget?: (endpoint: RelatedCreateTargetEndpoint) => void
}

export type BuildRelationship = (
	field: ResolvedField,
	picker: PickerRelationship,
) => RelationshipPlumbing

// Discriminator a field renderer dispatches on. Widget kinds (`text`,
// `number`, …) cover scalar/collection leaves; structural kinds carry the
// inline-group, list-of-objects, and map-of-objects shapes that the legacy
// monolith dispatched inside its `json` branch.
export type FieldKind =
	| ResourceFieldWidgetKind
	| "object"
	| "object-array"
	| "object-map"

export type FieldRendererProps = {
	field: ResolvedField
	rhf: WidgetControl
	referenceAutocomplete?: ReferenceAutocomplete
	referenceCandidates?: readonly ResourceReferenceCandidate[]
	referencesLoading?: boolean
	onReferenceSelect?: (ref: string) => void
	relationship?: RelationshipPlumbing
	buildRelationship?: BuildRelationship
	sourcePath?: string
}

export type FieldKindEntry = {
	kind: FieldKind
	Renderer: ComponentType<FieldRendererProps>
}
