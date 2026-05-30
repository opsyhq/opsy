import { useMemo } from "react"
import { ResourceDetailMessage } from "@/components/resource-detail/ResourceDetailMessage"
import type { ResolvedTypeView } from "@/components/resource-detail/resolvedTypeView"
import type { FieldLayoutSection } from "@/components/resource-fields/fieldLayout"
import { fieldLayoutRowsToResolvedFields } from "@/components/resource-fields/fieldLayout"
import { ResourceFieldsForm } from "@/components/resource-fields/ResourceFieldsForm"
import { ResourceFieldsView } from "@/components/resource-fields/ResourceFieldsView"
import type { RelatedCreateFieldRequest } from "@/lib/relatedResourceCreate"

export const RESOURCE_EDIT_FORM_ID = "resource-edit-form"

export function ResourceConfigurationPanel({
	values,
	displayValues,
	view,
	provider,
	projectSlug,
	mode,
	onSubmit,
	onCreateReferenceTarget,
	activeSection,
}: {
	values: Record<string, unknown> | null
	// Live state (inputs ∪ outputs) used to render computed-only field values in
	// edit mode. View mode already gets the merged state through `values`.
	displayValues?: Record<string, unknown>
	view: ResolvedTypeView | undefined
	provider: string | null
	projectSlug: string
	mode: "view" | "edit"
	onSubmit: (values: Record<string, unknown>, dirtyKeys: string[]) => void
	onCreateReferenceTarget?: (request: RelatedCreateFieldRequest) => void
	activeSection?: FieldLayoutSection | null
}) {
	const inputs = values ?? {}
	const editable = provider !== null

	const scopedView = useMemo(
		() =>
			view && activeSection
				? {
						...view,
						fields: fieldLayoutRowsToResolvedFields(activeSection.rows),
					}
				: view,
		[view, activeSection],
	)
	const layoutRows = activeSection?.rows

	if (!editable) {
		return (
			<ResourceDetailMessage className="min-h-[560px]">
				No provider configuration
			</ResourceDetailMessage>
		)
	}

	if (!view) {
		return (
			<ResourceDetailMessage className="min-h-[560px]">
				Resource schema is loading
			</ResourceDetailMessage>
		)
	}

	const editing = mode === "edit"

	return (
		<div className="flex flex-col gap-3">
			{editing ? (
				<ResourceFieldsForm
					view={scopedView ?? view}
					value={inputs}
					displayValues={displayValues}
					projectSlug={projectSlug}
					id={RESOURCE_EDIT_FORM_ID}
					layoutRows={layoutRows}
					onSubmit={onSubmit}
					onCreateReferenceTarget={onCreateReferenceTarget}
				/>
			) : (
				<ResourceFieldsView
					view={scopedView ?? view}
					values={inputs}
					layoutRows={layoutRows}
				/>
			)}
		</div>
	)
}
