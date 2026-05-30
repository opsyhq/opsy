import { X } from "lucide-react"
import { useRef, useState } from "react"
import { ResourcePicker } from "@/components/resource-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { makeRefValue, parseRefValue } from "@/lib/resourceRefs"
import { resourceFieldCollectionElementType } from "../resourceFieldInput"
import type { FieldRendererProps, ReferenceAutocomplete } from "../types"

export function ListKind({
	field,
	rhf,
	referenceAutocomplete,
	referenceCandidates,
	referencesLoading,
	onReferenceSelect,
}: FieldRendererProps) {
	const { value, onChange, onBlur } = rhf
	const autocomplete =
		referenceAutocomplete ??
		(referenceCandidates
			? {
					candidates: referenceCandidates,
					isLoading: referencesLoading,
					onSelect: onReferenceSelect,
				}
			: undefined)
	const arr = Array.isArray(value) ? (value as unknown[]) : []
	const [draft, setDraft] = useState("")
	const elemType = resourceFieldCollectionElementType(field)
	const allowsDuplicates =
		field.kind === "attribute" &&
		Array.isArray(field.tfType) &&
		field.tfType[0] === "list"
	const itemKeysRef = useRef<string[]>([])
	const nextItemKeyRef = useRef(0)
	while (itemKeysRef.current.length < arr.length) {
		itemKeysRef.current.push(`${field.path}:item:${nextItemKeyRef.current}`)
		nextItemKeyRef.current += 1
	}
	if (itemKeysRef.current.length > arr.length) {
		itemKeysRef.current.splice(arr.length)
	}
	return (
		<div className="grid gap-1.5">
			<div className="flex flex-wrap gap-1">
				{arr.map((item, i) => {
					const label = parseRefValue(item) ?? String(item)
					return (
						<Badge
							key={itemKeysRef.current[i]}
							variant="secondary"
							className="gap-1 font-mono text-[10px]"
						>
							{label}
							<Button
								type="button"
								size="icon-xs"
								variant="ghost"
								className="ml-1 size-4 rounded-sm text-muted-foreground hover:bg-transparent hover:text-foreground"
								aria-label={`Remove ${label}`}
								onClick={() => {
									const next = arr.slice()
									next.splice(i, 1)
									itemKeysRef.current.splice(i, 1)
									onChange(next.length === 0 ? undefined : next)
								}}
							>
								<X className="size-3" />
							</Button>
						</Badge>
					)
				})}
			</div>
			<ResourcePicker
				type="text"
				placeholder="Type and press Enter…"
				value={draft}
				onBlur={onBlur}
				onChange={(nextDraft) => setDraft(String(nextDraft ?? ""))}
				onEnter={(raw) => {
					const trimmed = raw.trim()
					const next = scalarValueFromDraft(trimmed, elemType)
					const nextKey = listItemKey(next)
					if (
						allowsDuplicates ||
						!arr.some((item) => listItemKey(item) === nextKey)
					) {
						onChange([...arr, next])
					}
					setDraft("")
				}}
				referenceAutocomplete={
					autocomplete
						? ({
								...autocomplete,
								onSelect: (ref: string) => {
									if (autocomplete.onSelect) {
										autocomplete.onSelect(ref)
									} else if (
										allowsDuplicates ||
										!arr.some((item) => parseRefValue(item) === ref)
									) {
										onChange([...arr, makeRefValue(ref)])
									}
									setDraft("")
								},
							} satisfies ReferenceAutocomplete)
						: undefined
				}
			/>
		</div>
	)
}

function scalarValueFromDraft(raw: string, type: unknown): unknown {
	if (type === "number") {
		const n = Number(raw)
		return Number.isNaN(n) ? raw : n
	}
	if (type === "bool") {
		if (raw === "true") return true
		if (raw === "false") return false
	}
	return raw
}

// Normalize ref-objects and scalars to a comparable form so adding "foo" while
// the list holds {kind:'ref', ref:'foo'} (or vice versa) is detected as a dup.
function listItemKey(item: unknown): string {
	const ref = parseRefValue(item)
	if (ref != null) return `ref:${ref}`
	return `raw:${String(item)}`
}
