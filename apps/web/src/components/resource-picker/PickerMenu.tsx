import { relationshipSelectableLabel } from "@/components/resource-fields/resourceFieldInput"
import type { RelationshipPlumbing } from "@/components/resource-fields/types"
import {
	AutocompleteCollection,
	AutocompleteContent,
	AutocompleteEmpty,
	AutocompleteGroup,
	AutocompleteGroupLabel,
	AutocompleteList,
} from "@/components/ui/autocomplete"
import { PickerRow, type ReferenceMenuItem } from "./PickerRow"

export type ReferenceTrigger =
	| {
			kind: "resource"
			query: string
	  }
	| {
			kind: "field"
			query: string
			resource: import("./PickerRow").ReferenceResourceOption
	  }

export function PickerMenu({
	trigger,
	relationshipMenu,
	isLoading,
	onSelect,
}: {
	trigger: ReferenceTrigger | null
	relationshipMenu: { relationship: RelationshipPlumbing } | null
	isLoading?: boolean
	onSelect: (item: ReferenceMenuItem) => void
}) {
	if (relationshipMenu) {
		const { relationship } = relationshipMenu
		const candidatesEmpty = relationship.candidates.length === 0
		return (
			<AutocompleteContent>
				<AutocompleteList>
					<AutocompleteGroup>
						<AutocompleteGroupLabel>
							{relationshipSelectableLabel(relationship.relationship)}
						</AutocompleteGroupLabel>
						<AutocompleteCollection>
							{(item: ReferenceMenuItem) => (
								<PickerRow item={item} onSelect={onSelect} />
							)}
						</AutocompleteCollection>
						{candidatesEmpty && (
							<AutocompleteEmpty>
								{relationship.isLoading
									? "Loading…"
									: relationship.isError
										? "Couldn't load candidates"
										: "No matching resources"}
							</AutocompleteEmpty>
						)}
					</AutocompleteGroup>
				</AutocompleteList>
			</AutocompleteContent>
		)
	}
	if (!trigger) return null
	return (
		<AutocompleteContent>
			<AutocompleteList>
				<AutocompleteGroup>
					<AutocompleteGroupLabel>
						{trigger.kind === "resource"
							? "Resources"
							: `${trigger.resource.slug} fields`}
					</AutocompleteGroupLabel>
					<AutocompleteCollection>
						{(item: ReferenceMenuItem) => (
							<PickerRow item={item} onSelect={onSelect} />
						)}
					</AutocompleteCollection>
					<AutocompleteEmpty>
						{isLoading
							? "Loading resources..."
							: trigger.kind === "resource"
								? "No matching resources"
								: "No matching fields"}
					</AutocompleteEmpty>
				</AutocompleteGroup>
			</AutocompleteList>
		</AutocompleteContent>
	)
}
