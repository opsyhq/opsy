import { Check, ChevronDown, ChevronRight, Minus } from "lucide-react"
import { useState } from "react"
import { LucideFieldIcon } from "@/components/LucideFieldIcon"
import type { ResolvedField } from "@/components/resource-detail/resolvedTypeView"
import { Badge } from "@/components/ui/badge"
import { isRecord } from "@/lib/changeDiff"
import { parseRefValue, refStrings } from "@/lib/resourceRefs"
import { cn } from "@/lib/utils"
import { FieldHelpLabel } from "./ResourceFieldChrome"
import {
	type ResourceFieldInput,
	type ResourceFieldWidgetKind,
	resolveResourceFieldInput,
	resourceFieldCollectionKind,
} from "./resourceFieldInput"

const MASK = "••••••"

function isEmpty(v: unknown): boolean {
	if (v === undefined || v === null || v === "") return true
	if (Array.isArray(v) && v.length === 0) return true
	if (typeof v === "object" && Object.keys(v as object).length === 0)
		return true
	return false
}

function coerceBool(v: unknown): boolean | null {
	if (v === true || v === "true") return true
	if (v === false || v === "false") return false
	return null
}

const isRecordValue = isRecord

function scalarText(value: unknown): string | null {
	const ref = parseRefValue(value)
	if (ref) return ref
	if (typeof value === "string") return value
	if (
		typeof value === "number" ||
		typeof value === "boolean" ||
		typeof value === "bigint"
	) {
		return String(value)
	}
	return null
}

function stableValueKey(value: unknown): string {
	const scalar = scalarText(value)
	if (scalar) return scalar
	if (Array.isArray(value)) return `array:${value.length}`
	if (isRecordValue(value))
		return `object:${Object.keys(value).sort().join(",")}`
	return typeof value
}

function keyedValues(values: readonly unknown[]) {
	const seen = new Map<string, number>()
	return values.map((value) => {
		const base = stableValueKey(value)
		const count = (seen.get(base) ?? 0) + 1
		seen.set(base, count)
		return { value, key: count === 1 ? base : `${base}#${count}` }
	})
}

export function ResourceFieldValueRow({
	field,
	value,
}: {
	field: ResolvedField
	value: unknown
}) {
	const input = resolveResourceFieldInput(field)
	const stacked = input.kind === "field-group" && !isEmpty(value)
	return (
		<div
			className={cn(
				"grid items-center",
				stacked ? "grid-cols-1" : "grid-cols-[30%_1fr]",
			)}
		>
			<div className="flex min-w-0 items-center gap-1.5 px-3 py-2 text-sm font-light text-muted-foreground">
				<FieldHelpLabel label={field.label} help={field.help} />
				<LucideFieldIcon icon={field.icon} />
			</div>
			<div
				className={cn(
					"flex min-w-0 flex-col items-center gap-1 px-3 py-2 text-center",
					stacked && "items-start pl-3 text-left",
				)}
			>
				<FieldValueView field={field} input={input} value={value} />
			</div>
		</div>
	)
}

function FieldValueView({
	field,
	input,
	value,
	muted,
}: {
	field: ResolvedField
	input: ResourceFieldInput
	value: unknown
	muted?: boolean
}) {
	if (isEmpty(value)) {
		return <span className="text-sm text-muted-foreground">—</span>
	}
	if (field.sensitive) {
		return <span className="font-mono text-xs">{MASK}</span>
	}
	if (input.kind === "field-group") {
		return (
			<ObjectFieldsView
				fields={field.children ?? []}
				value={value}
				muted={muted}
			/>
		)
	}
	if (input.kind === "relationship") {
		const refs = refStrings(value)
		if (refs.length > 0)
			return <ReferenceValue refs={refs} muted={muted} relationship />
		return (
			<WidgetValueView
				field={field}
				kind={input.manualWidgetKind}
				value={value}
				muted={muted}
			/>
		)
	}
	return (
		<WidgetValueView
			field={field}
			kind={input.kind}
			value={value}
			muted={muted}
		/>
	)
}

function WidgetValueView({
	field,
	kind,
	value,
	muted,
}: {
	field: ResolvedField
	kind: ResourceFieldWidgetKind
	value: unknown
	muted?: boolean
}) {
	const ref = parseRefValue(value)
	if (ref) return <ReferenceValue refs={[ref]} muted={muted} />

	if (kind === "bool") {
		const b = coerceBool(value)
		if (b === null)
			return <StructuredValue value={value} muted={muted} compact />
		return (
			<span className="inline-flex items-center gap-1 text-xs">
				{b ? (
					<Check className="size-3.5 text-emerald-600" />
				) : (
					<Minus className="size-3.5 text-muted-foreground" />
				)}
				<span className={cn("font-mono", muted && "text-muted-foreground")}>
					{b ? "true" : "false"}
				</span>
			</span>
		)
	}

	if (kind === "list") {
		if (!Array.isArray(value)) {
			return <StructuredValue value={value} muted={muted} compact />
		}
		const arr = value
		const refs = refStrings(value)
		if (refs.length === arr.length)
			return <ReferenceValue refs={refs} muted={muted} />
		return (
			<div className="flex flex-wrap gap-1">
				{keyedValues(arr).map(({ value: item, key }) => {
					const text = scalarText(item)
					return text ? (
						<Badge
							key={key}
							variant="secondary"
							className={cn("font-mono text-[10px]", muted && "opacity-70")}
						>
							{text}
						</Badge>
					) : (
						<StructuredValue key={key} value={item} muted={muted} compact />
					)
				})}
			</div>
		)
	}

	if (kind === "kv") {
		const obj =
			value && typeof value === "object" && !Array.isArray(value)
				? (value as Record<string, unknown>)
				: {}
		const entries = Object.entries(obj)
		if (entries.length === 0)
			return <span className="text-sm text-muted-foreground">—</span>
		return (
			<div className="grid gap-0.5">
				{entries.map(([k, v]) => (
					<div
						key={k}
						className={cn(
							"flex items-center gap-1 font-mono text-[11px]",
							muted && "text-muted-foreground",
						)}
					>
						<span className="truncate">{k}</span>
						<span className="text-muted-foreground">=</span>
						<span className="flex-1 truncate text-muted-foreground">
							<StructuredValue value={v} muted compact />
						</span>
					</div>
				))}
			</div>
		)
	}

	if (kind === "json") {
		const collectionKind = resourceFieldCollectionKind(field)
		if ((field.children?.length ?? 0) > 0 && collectionKind === "array") {
			return <ObjectArrayView field={field} value={value} muted={muted} />
		}
		if ((field.children?.length ?? 0) > 0 && collectionKind === "map") {
			return <ObjectMapView field={field} value={value} muted={muted} />
		}
		if ((field.children?.length ?? 0) > 0) {
			return (
				<ObjectFieldsView
					fields={field.children ?? []}
					value={value}
					muted={muted}
				/>
			)
		}
		return <StructuredValue value={value} muted={muted} />
	}

	if (kind === "number") {
		return <StructuredValue value={value} muted={muted} compact />
	}

	return <StructuredValue value={value} muted={muted} compact />
}

function ReferenceValue({
	refs,
	muted,
	relationship,
}: {
	refs: readonly string[]
	muted?: boolean
	relationship?: boolean
}) {
	return (
		<div className="flex flex-wrap gap-1">
			{refs.map((ref) => {
				const [resource, ...pathParts] = ref.split(".")
				const path = pathParts.length > 0 ? pathParts.join(".") : null
				return (
					<Badge
						key={ref}
						variant="outline"
						className={cn(
							"gap-1.5 font-mono text-[10px]",
							muted && "opacity-70",
						)}
						title={ref}
					>
						<span>{relationship ? resource || ref : ref}</span>
						{relationship && path && (
							<span className="border-l border-border pl-1 text-muted-foreground">
								linked {path}
							</span>
						)}
					</Badge>
				)
			})}
		</div>
	)
}

function ObjectFieldsView({
	fields,
	value,
	muted,
}: {
	fields: readonly ResolvedField[]
	value: unknown
	muted?: boolean
}) {
	const obj = isRecordValue(value) ? value : {}
	if (fields.length === 0)
		return <StructuredValue value={value} muted={muted} />
	return (
		<div className="grid gap-1 border-l pl-3">
			{fields.map((child) => (
				<ResourceFieldValueRow
					key={child.path}
					field={child}
					value={obj[child.terraformName]}
				/>
			))}
		</div>
	)
}

function ObjectArrayView({
	field,
	value,
	muted,
}: {
	field: ResolvedField
	value: unknown
	muted?: boolean
}) {
	const rows = Array.isArray(value) ? value : []
	if (rows.length === 0)
		return <span className="text-sm text-muted-foreground">—</span>
	return (
		<div className="grid gap-2">
			{keyedValues(rows).map(({ value: row, key }, index) => (
				<div
					key={key}
					className={cn(
						"grid gap-2 rounded-md border border-border bg-muted/20 p-2",
						muted && "opacity-70",
					)}
				>
					<span className="text-xs font-medium text-muted-foreground">
						{field.label} {index + 1}
					</span>
					<ObjectFieldsView
						fields={field.children ?? []}
						value={row}
						muted={muted}
					/>
				</div>
			))}
		</div>
	)
}

function ObjectMapView({
	field,
	value,
	muted,
}: {
	field: ResolvedField
	value: unknown
	muted?: boolean
}) {
	const entries = isRecordValue(value) ? Object.entries(value) : []
	if (entries.length === 0)
		return <span className="text-sm text-muted-foreground">—</span>
	return (
		<div className="grid gap-2">
			{entries.map(([key, entry]) => (
				<div
					key={key}
					className={cn(
						"grid gap-2 rounded-md border border-border bg-muted/20 p-2",
						muted && "opacity-70",
					)}
				>
					<span className="font-mono text-xs text-muted-foreground">{key}</span>
					<ObjectFieldsView
						fields={field.children ?? []}
						value={entry}
						muted={muted}
					/>
				</div>
			))}
		</div>
	)
}

function StructuredValue({
	value,
	muted,
	compact,
}: {
	value: unknown
	muted?: boolean
	compact?: boolean
}) {
	const text = scalarText(value)
	if (text !== null) {
		return (
			<span
				className={cn(
					"min-w-0 break-all font-mono text-xs",
					muted ? "text-muted-foreground" : "text-foreground",
				)}
				title={text}
			>
				{text}
			</span>
		)
	}
	if (Array.isArray(value)) {
		if (value.length === 0)
			return <span className="text-sm text-muted-foreground">—</span>
		return (
			<div className={cn("grid gap-1", compact && "w-full")}>
				{keyedValues(value).map(({ value: item, key }, index) => (
					<div key={key} className="flex min-w-0 items-start gap-1.5">
						<span className="font-mono text-[10px] text-muted-foreground">
							{index + 1}
						</span>
						<StructuredValue value={item} muted={muted} compact />
					</div>
				))}
			</div>
		)
	}
	if (!isRecordValue(value))
		return <span className="text-sm text-muted-foreground">—</span>
	return <RecordValue value={value} muted={muted} compact={compact} />
}

function RecordValue({
	value,
	muted,
	compact,
}: {
	value: Record<string, unknown>
	muted?: boolean
	compact?: boolean
}) {
	const [open, setOpen] = useState(false)
	const entries = Object.entries(value)
	if (entries.length === 0)
		return <span className="text-sm text-muted-foreground">—</span>
	return (
		<div className="grid gap-1 min-w-0">
			<button
				type="button"
				onClick={() => setOpen((s) => !s)}
				className={cn(
					"flex cursor-pointer items-center gap-1 text-left font-mono text-xs hover:text-foreground",
					muted && "text-muted-foreground",
				)}
			>
				{open ? (
					<ChevronDown className="size-3" />
				) : (
					<ChevronRight className="size-3" />
				)}
				<span className="truncate">
					{entries.length} field{entries.length === 1 ? "" : "s"}
				</span>
			</button>
			{open && (
				<div
					className={cn(
						"grid gap-1 rounded border bg-muted/30 p-2",
						compact && "w-full",
					)}
				>
					{entries.map(([key, entry]) => (
						<div key={key} className="grid min-w-0 gap-0.5">
							<span className="font-mono text-[10px] text-muted-foreground">
								{key}
							</span>
							<StructuredValue value={entry} muted={muted} compact />
						</div>
					))}
				</div>
			)}
		</div>
	)
}
