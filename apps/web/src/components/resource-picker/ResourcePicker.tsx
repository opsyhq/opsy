import { X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { ResolvedField } from "@/components/resource-detail/resolvedTypeView"
import { relationshipSelectableLabel } from "@/components/resource-fields/resourceFieldInput"
import type {
	ReferenceAutocomplete,
	RelationshipPlumbing,
} from "@/components/resource-fields/types"
import { Autocomplete, AutocompleteInput } from "@/components/ui/autocomplete"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupText,
} from "@/components/ui/input-group"
import type { RelatedCreateTargetEndpoint } from "@/lib/relatedResourceCreate"
import type { ResourceReferenceCandidate } from "@/lib/resourceRefs"
import {
	makeRefValue,
	parseRefString,
	parseRefValue,
	referenceValueForSelection,
} from "@/lib/resourceRefs"
import { PickerMenu, type ReferenceTrigger } from "./PickerMenu"
import type { ReferenceMenuItem, ReferenceResourceOption } from "./PickerRow"

export function ResourcePicker({
	type,
	placeholder,
	value,
	onChange,
	onBlur,
	onEnter,
	referenceAutocomplete,
	relationship,
}: {
	type: "password" | "text"
	placeholder?: string
	value: unknown
	onChange: (v: unknown) => void
	onBlur: () => void
	onEnter?: (raw: string) => void
	referenceAutocomplete?: ReferenceAutocomplete
	relationship?: RelationshipPlumbing
}) {
	const ref = parseRefValue(value)
	const inputRef = useRef<HTMLInputElement>(null)
	const [pendingResource, setPendingResource] =
		useState<ReferenceResourceOption | null>(null)
	const [trigger, setTrigger] = useState<ReferenceTrigger | null>(null)
	const [isFocused, setIsFocused] = useState(false)
	const raw =
		ref == null && typeof value === "string"
			? value
			: value == null || ref != null
				? ""
				: String(value)
	const [draft, setDraft] = useState(raw)
	const candidates = referenceAutocomplete?.candidates
	const resources = useMemo(
		() => (candidates ? referenceResourceOptions(candidates) : []),
		[candidates],
	)
	const parsedRef = ref ? parseRefString(ref) : null
	const refResource =
		parsedRef == null
			? null
			: resources.find((resource) => resource.slug === parsedRef.slug)
	const relationshipCandidateForRef =
		parsedRef && relationship
			? relationship.candidates.find((candidate) => {
					const parsed = parseRefString(candidate.ref.$ref)
					return parsed?.slug === parsedRef.slug
				})
			: null
	const displayResourceLabel =
		pendingResource?.displayName ||
		pendingResource?.slug ||
		refResource?.displayName ||
		refResource?.slug ||
		relationshipCandidateForRef?.displayName ||
		relationshipCandidateForRef?.slug ||
		parsedRef?.slug ||
		null
	const displayFieldLabel = pendingResource ? "-" : parsedRef?.path
	useEffect(() => {
		setDraft(raw)
		if (ref) {
			setPendingResource(null)
			setTrigger(null)
		}
	}, [raw, ref])
	const clearReference = () => {
		setDraft("")
		setPendingResource(null)
		setTrigger(null)
		onChange(undefined)
		requestAnimationFrame(() => inputRef.current?.focus())
	}
	const selectRef = (nextRef: string) => {
		setDraft("")
		setPendingResource(null)
		if (referenceAutocomplete?.onSelect) {
			referenceAutocomplete.onSelect(nextRef)
		} else {
			onChange(
				referenceValueForSelection({
					value,
					ref: nextRef,
					cardinality: "one",
				}),
			)
		}
		setTrigger(null)
	}
	const updateText = (next: string, cursor = next.length) => {
		setDraft(next)
		if (type !== "text" || !referenceAutocomplete) {
			onChange(next || undefined)
			return
		}
		if (pendingResource) {
			setTrigger({ kind: "field", query: next, resource: pendingResource })
			return
		}
		setTrigger(referenceTriggerForInput(next, cursor, resources))
		onChange(next || undefined)
	}
	const showRelationshipMenu =
		!!relationship && isFocused && trigger === null && !pendingResource
	const relationshipCandidates = relationship?.candidates
	const relationshipCreateTargets = relationship?.createTargets
	const menuItems = useMemo(
		() =>
			showRelationshipMenu &&
			relationshipCandidates &&
			relationshipCreateTargets
				? relationshipMenuItemsFromCandidates(
						relationshipCandidates,
						relationshipCreateTargets,
						draft,
					)
				: referenceMenuItems(trigger, resources),
		[
			showRelationshipMenu,
			relationshipCandidates,
			relationshipCreateTargets,
			draft,
			trigger,
			resources,
		],
	)
	const highlightedItemRef = useRef<ReferenceMenuItem | null>(null)
	const commitMenuItem = (item: ReferenceMenuItem | null | undefined) => {
		if (!item) return
		highlightedItemRef.current = null
		switch (item.kind) {
			case "create":
				relationship?.onCreateTarget?.(item.endpoint)
				setTrigger(null)
				return
			case "candidate":
				selectRef(item.candidate.ref.$ref)
				return
			case "field":
				selectRef(item.ref)
				return
			case "resource":
				setDraft("")
				setPendingResource(item.resource)
				setTrigger({ kind: "field", query: "", resource: item.resource })
				onChange(undefined)
				requestAnimationFrame(() => {
					inputRef.current?.focus()
					inputRef.current?.setSelectionRange(0, 0)
				})
		}
	}
	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Escape" && (trigger || showRelationshipMenu)) {
			event.preventDefault()
			if (pendingResource) {
				setPendingResource(null)
				setDraft("")
			}
			setTrigger(null)
			if (showRelationshipMenu) inputRef.current?.blur()
			return
		}
		if (event.key === "Backspace" && pendingResource && draft === "") {
			setPendingResource(null)
			setTrigger(null)
			return
		}
		if (event.key === "Enter" && highlightedItemRef.current) {
			event.preventDefault()
			event.stopPropagation()
			commitMenuItem(highlightedItemRef.current)
			return
		}
		if (event.key === "Enter" && onEnter && draft.trim() && !trigger) {
			event.preventDefault()
			onEnter(draft)
		}
	}

	if (type === "text" && ref && displayResourceLabel && displayFieldLabel) {
		return (
			<InputGroup>
				<InputGroupAddon className="min-w-0 flex-1 justify-start">
					<InputGroupText className="min-w-0 gap-1.5">
						<span className="truncate">{displayResourceLabel}</span>
						<span>·</span>
						<span className="truncate font-mono">{displayFieldLabel}</span>
					</InputGroupText>
				</InputGroupAddon>
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						size="icon-xs"
						aria-label="Clear linked resource"
						onClick={clearReference}
					>
						<X className="size-3" />
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		)
	}

	if (type === "text" && (referenceAutocomplete || relationship)) {
		const open = trigger !== null || showRelationshipMenu
		const relationshipPlaceholder = relationship
			? `Select ${relationshipSelectableLabel(relationship.relationship)} or type a value`
			: undefined
		return (
			<Autocomplete
				items={menuItems}
				value={draft}
				mode="none"
				open={open}
				onOpenChange={(nextOpen, details) => {
					if (nextOpen) return
					if (details.reason === "item-press") return
					setTrigger(null)
				}}
				onValueChange={(next, details) => {
					if (details.reason === "item-press") {
						if (details.event instanceof KeyboardEvent) {
							commitMenuItem(highlightedItemRef.current)
						}
						return
					}
					updateText(next, inputRef.current?.selectionStart ?? next.length)
				}}
				onItemHighlighted={(item) => {
					highlightedItemRef.current = item ?? null
				}}
				itemToStringValue={() => ""}
			>
				<InputGroup>
					{pendingResource && (
						<InputGroupAddon className="min-w-0 max-w-[65%] justify-start">
							<InputGroupText className="min-w-0 gap-1.5">
								<span className="truncate">
									{pendingResource.displayName || pendingResource.slug}
								</span>
								<span>·</span>
								<span className="font-mono">-</span>
							</InputGroupText>
						</InputGroupAddon>
					)}
					<AutocompleteInput
						ref={inputRef}
						data-slot="input-group-control"
						type="text"
						placeholder={
							pendingResource
								? "Select field"
								: (placeholder ?? relationshipPlaceholder)
						}
						className="flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
						showTrigger={!!relationship}
						onFocus={() => setIsFocused(true)}
						onBlur={() => {
							setIsFocused(false)
							onBlur()
						}}
						onKeyDown={handleKeyDown}
					/>
					{pendingResource && (
						<InputGroupAddon align="inline-end">
							<InputGroupButton
								size="icon-xs"
								aria-label="Clear linked resource"
								onMouseDown={(event) => event.preventDefault()}
								onClick={clearReference}
							>
								<X className="size-3" />
							</InputGroupButton>
						</InputGroupAddon>
					)}
				</InputGroup>
				<PickerMenu
					trigger={trigger}
					relationshipMenu={
						showRelationshipMenu && relationship ? { relationship } : null
					}
					isLoading={referenceAutocomplete?.isLoading}
					onSelect={commitMenuItem}
				/>
			</Autocomplete>
		)
	}

	return (
		<Input
			type={type}
			placeholder={placeholder}
			value={raw}
			onBlur={onBlur}
			onChange={(e) => onChange(e.target.value || undefined)}
			onKeyDown={(event) => {
				if (event.key === "Enter" && onEnter && raw.trim()) {
					event.preventDefault()
					onEnter(raw)
				}
			}}
		/>
	)
}

export function ResourcePickerMulti({
	field,
	value,
	onChange,
	onBlur,
	relationship,
	referenceAutocomplete,
}: {
	field: ResolvedField
	value: unknown
	onChange: (v: unknown) => void
	onBlur: () => void
	relationship: RelationshipPlumbing
	referenceAutocomplete?: ReferenceAutocomplete
}) {
	const arr = Array.isArray(value) ? (value as unknown[]) : []
	const [draft, setDraft] = useState("")
	const itemKeysRef = useRef<string[]>([])
	const nextItemKeyRef = useRef(0)
	while (itemKeysRef.current.length < arr.length) {
		itemKeysRef.current.push(`${field.path}:item:${nextItemKeyRef.current}`)
		nextItemKeyRef.current += 1
	}
	if (itemKeysRef.current.length > arr.length) {
		itemKeysRef.current.splice(arr.length)
	}
	const addEntry = (entry: unknown) => {
		onChange([...arr, entry])
	}
	const removeAt = (index: number) => {
		const next = arr.slice()
		next.splice(index, 1)
		itemKeysRef.current.splice(index, 1)
		onChange(next.length === 0 ? undefined : next)
	}
	const addRef = (ref: string) => {
		addEntry(makeRefValue(ref))
		setDraft("")
	}
	const multiAutocomplete: ReferenceAutocomplete = {
		...(referenceAutocomplete ?? {
			candidates: relationship.candidates,
			isLoading: relationship.isLoading,
		}),
		onSelect: addRef,
	}
	return (
		<div className="grid gap-1.5">
			{arr.length > 0 && (
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
									onClick={() => removeAt(i)}
								>
									<X className="size-3" />
								</Button>
							</Badge>
						)
					})}
				</div>
			)}
			<ResourcePicker
				type="text"
				placeholder={`Add ${relationshipSelectableLabel(relationship.relationship)} or type a value`}
				value={draft}
				onBlur={onBlur}
				onChange={(nextDraft) => setDraft(String(nextDraft ?? ""))}
				onEnter={(raw) => {
					const trimmed = raw.trim()
					if (!trimmed) return
					addEntry(trimmed)
					setDraft("")
				}}
				referenceAutocomplete={multiAutocomplete}
				relationship={relationship}
			/>
		</div>
	)
}

function referenceResourceOptions(
	candidates: readonly ResourceReferenceCandidate[],
): ReferenceResourceOption[] {
	const bySlug = new Map<string, ReferenceResourceOption>()
	for (const candidate of candidates) {
		const parsed = parseRefString(candidate.ref.$ref)
		if (!parsed) continue
		const option = bySlug.get(candidate.slug) ?? {
			slug: candidate.slug,
			type: candidate.type,
			displayName: candidate.displayName,
			fields: [],
		}
		if (!option.fields.some((field) => field.path === parsed.path)) {
			option.fields.push({ path: parsed.path, ref: candidate.ref.$ref })
		}
		bySlug.set(candidate.slug, option)
	}
	return [...bySlug.values()].map((option) => ({
		...option,
		fields: [...option.fields].sort((a, b) => a.path.localeCompare(b.path)),
	}))
}

function referenceTriggerForInput(
	text: string,
	cursor: number,
	resources: readonly ReferenceResourceOption[],
): ReferenceTrigger | null {
	const safeCursor = Math.max(0, Math.min(text.length, cursor))
	let rangeStart = safeCursor - 1
	while (rangeStart >= 0 && !/\s/.test(text[rangeStart] ?? "")) {
		rangeStart -= 1
	}
	rangeStart += 1
	const token = text.slice(rangeStart, safeCursor)
	if (!token.startsWith("$") || token.startsWith("$ref")) return null
	const query = token.slice(1)
	const dot = query.indexOf(".")
	if (dot === -1) {
		return { kind: "resource", query }
	}
	const slug = query.slice(0, dot)
	const resource = resources.find((candidate) => candidate.slug === slug)
	if (!resource) {
		return { kind: "resource", query }
	}
	return {
		kind: "field",
		query: query.slice(dot + 1),
		resource,
	}
}

function referenceMenuItems(
	trigger: ReferenceTrigger | null,
	resources: readonly ReferenceResourceOption[],
): readonly ReferenceMenuItem[] {
	if (!trigger) return []
	const query = trigger.query.toLowerCase()
	if (trigger.kind === "field") {
		return trigger.resource.fields
			.filter((field) => field.path.toLowerCase().includes(query))
			.map((field) => ({ kind: "field" as const, ...field }))
	}
	return resources
		.filter(
			(resource) =>
				resource.slug.toLowerCase().includes(query) ||
				resource.type.toLowerCase().includes(query) ||
				(resource.displayName?.toLowerCase().includes(query) ?? false),
		)
		.map((resource) => ({ kind: "resource" as const, resource }))
}

function relationshipMenuItemsFromCandidates(
	candidates: readonly ResourceReferenceCandidate[],
	createTargets: readonly RelatedCreateTargetEndpoint[],
	query: string,
): readonly ReferenceMenuItem[] {
	const q = query.trim().toLowerCase()
	const matching = q
		? candidates.filter((candidate) => {
				if (candidate.slug.toLowerCase().includes(q)) return true
				if (candidate.type.toLowerCase().includes(q)) return true
				return candidate.displayName?.toLowerCase().includes(q) ?? false
			})
		: candidates
	const items: ReferenceMenuItem[] = matching.map((candidate) => ({
		kind: "candidate" as const,
		candidate,
	}))
	for (const endpoint of createTargets) {
		items.push({ kind: "create" as const, endpoint })
	}
	return items
}
