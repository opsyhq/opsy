import { Plus } from "lucide-react"
import { AutocompleteItem } from "@/components/ui/autocomplete"
import type { RelatedCreateTargetEndpoint } from "@/lib/relatedResourceCreate"
import type { ResourceReferenceCandidate } from "@/lib/resourceRefs"
import { parseRefString } from "@/lib/resourceRefs"

export type ReferenceResourceOption = {
	slug: string
	type: string
	displayName: string | null
	fields: Array<{ path: string; ref: string }>
}

export type ReferenceMenuItem =
	| { kind: "resource"; resource: ReferenceResourceOption }
	| { kind: "field"; path: string; ref: string }
	| { kind: "candidate"; candidate: ResourceReferenceCandidate }
	| { kind: "create"; endpoint: RelatedCreateTargetEndpoint }

export function PickerRow({
	item,
	onSelect,
}: {
	item: ReferenceMenuItem
	onSelect: (item: ReferenceMenuItem) => void
}) {
	switch (item.kind) {
		case "candidate": {
			const refLabel = parseRefString(item.candidate.ref.$ref)?.path ?? "id"
			return (
				<AutocompleteItem
					key={`candidate:${item.candidate.ref.$ref}`}
					value={item}
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => onSelect(item)}
				>
					<span className="min-w-0 flex-1 truncate">
						{item.candidate.displayName || item.candidate.slug}
					</span>
					<span className="shrink-0 font-mono text-[10px] text-muted-foreground">
						{refLabel}
					</span>
				</AutocompleteItem>
			)
		}
		case "create":
			return (
				<AutocompleteItem
					key={`create:${item.endpoint.type}:${item.endpoint.path}`}
					value={item}
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => onSelect(item)}
				>
					<Plus className="size-3.5" />
					<span className="min-w-0 flex-1 truncate">
						Create new {item.endpoint.type}
					</span>
				</AutocompleteItem>
			)
		case "resource":
			return (
				<AutocompleteItem
					key={item.resource.slug}
					value={item}
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => onSelect(item)}
				>
					<span className="min-w-0 flex-1 truncate">
						{item.resource.displayName || item.resource.slug}
					</span>
					<span className="shrink-0 font-mono text-[10px] text-muted-foreground">
						{item.resource.type}
					</span>
				</AutocompleteItem>
			)
		case "field":
			return (
				<AutocompleteItem
					key={item.ref}
					value={item}
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => onSelect(item)}
				>
					<span className="truncate font-mono text-xs">{item.path}</span>
				</AutocompleteItem>
			)
	}
}
