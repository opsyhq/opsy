import { Plus } from "lucide-react"
import { type ReactNode, useMemo } from "react"
import { LucideFieldIcon } from "@/components/LucideFieldIcon"
import type { ResolvedField } from "@/components/resource-detail/resolvedTypeView"
import { Button } from "@/components/ui/button"
import { isRecord } from "@/lib/changeDiff"
import { FieldRenderer, resolveFieldKind } from "../FieldRenderer"
import { DeprecatedBadge, FieldHelpWrap } from "../ResourceFieldChrome"
import {
	resolveResourceFieldInput,
	resourceFieldCollectionKind,
	valueAddress,
} from "../resourceFieldInput"
import type { FieldRendererProps } from "../types"

const isRecordValue = isRecord

export function ObjectKind(props: FieldRendererProps) {
	const { field } = props
	return (
		<ObjectFields
			{...props}
			fields={field.children ?? []}
			value={props.rhf.value}
			onChange={props.rhf.onChange}
			onBlur={props.rhf.onBlur}
		/>
	)
}

type ObjectFieldsExtras = Pick<
	FieldRendererProps,
	| "referenceAutocomplete"
	| "referenceCandidates"
	| "referencesLoading"
	| "onReferenceSelect"
	| "buildRelationship"
	| "sourcePath"
>

export function ObjectFields({
	fields,
	value,
	onChange,
	onBlur,
	referenceAutocomplete,
	referenceCandidates,
	referencesLoading,
	onReferenceSelect,
	buildRelationship,
	sourcePath,
}: {
	fields: readonly ResolvedField[]
	value: unknown
	onChange: (v: unknown) => void
	onBlur: () => void
} & ObjectFieldsExtras) {
	const record = isRecordValue(value) ? value : {}
	const updateField = (field: ResolvedField, nextValue: unknown) => {
		const next = { ...record }
		if (isEmptyInputValue(nextValue)) delete next[field.terraformName]
		else next[field.terraformName] = nextValue
		onChange(Object.keys(next).length === 0 ? undefined : next)
	}

	return (
		<div className="grid gap-3">
			{fields.map((field) => (
				<ObjectFieldRow
					key={field.path}
					field={field}
					value={record[field.terraformName]}
					onChange={(nextValue) => updateField(field, nextValue)}
					onBlur={onBlur}
					referenceAutocomplete={referenceAutocomplete}
					referenceCandidates={referenceCandidates}
					referencesLoading={referencesLoading}
					onReferenceSelect={onReferenceSelect}
					buildRelationship={buildRelationship}
					sourcePath={valueAddress(sourcePath, { child: field })}
				/>
			))}
		</div>
	)
}

function ObjectFieldRow({
	field,
	value,
	onChange,
	onBlur,
	referenceAutocomplete,
	referenceCandidates,
	referencesLoading,
	onReferenceSelect,
	buildRelationship,
	sourcePath,
}: {
	field: ResolvedField
	value: unknown
	onChange: (v: unknown) => void
	onBlur: () => void
} & ObjectFieldsExtras) {
	const input = resolveResourceFieldInput(field)
	const pickerForField =
		input.kind === "relationship" ? input.relationship : null
	const relationship = useMemo(
		() =>
			pickerForField && buildRelationship
				? buildRelationship(field, pickerForField)
				: undefined,
		[buildRelationship, field, pickerForField],
	)

	const isArrayObject =
		(field.children?.length ?? 0) > 0 &&
		resourceFieldCollectionKind(field) === "array"
	const arrayRows = isArrayObject && Array.isArray(value) ? value : []
	const arrayMaxReached =
		isArrayObject &&
		field.maxItems !== undefined &&
		arrayRows.length >= field.maxItems
	const addArrayRow = () => onChange([...arrayRows, {}])
	const kind = resolveFieldKind(field, input)

	return (
		<div className="grid gap-1.5">
			<ObjectFieldHeader
				field={field}
				trailing={
					isArrayObject ? (
						<Button
							type="button"
							size="icon-xs"
							variant="ghost"
							className="text-muted-foreground hover:bg-transparent hover:text-foreground"
							aria-label={`Add ${field.label}`}
							disabled={arrayMaxReached}
							onClick={addArrayRow}
						>
							<Plus className="size-3.5" />
						</Button>
					) : undefined
				}
			/>
			<FieldRenderer
				field={field}
				kind={kind}
				rhf={{ value, onChange, onBlur }}
				referenceAutocomplete={referenceAutocomplete}
				referenceCandidates={referenceCandidates}
				referencesLoading={referencesLoading}
				onReferenceSelect={onReferenceSelect}
				relationship={relationship}
				buildRelationship={buildRelationship}
				sourcePath={sourcePath}
			/>
			{field.deprecationMessage && (
				<p className="text-xs text-muted-foreground/70">
					{field.deprecationMessage}
				</p>
			)}
		</div>
	)
}

function ObjectFieldHeader({
	field,
	trailing,
}: {
	field: ResolvedField
	trailing?: ReactNode
}) {
	return (
		<div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-muted-foreground">
			<LucideFieldIcon icon={field.icon} />
			<FieldHelpWrap label={field.label} help={field.help}>
				<span className="min-w-0 truncate hover:text-foreground">
					{field.label}
				</span>
			</FieldHelpWrap>
			{field.required && <span className="text-destructive">*</span>}
			{field.deprecated && <DeprecatedBadge />}
			{trailing}
		</div>
	)
}

export function isEmptyInputValue(value: unknown): boolean {
	if (value === undefined || value === null || value === "") return true
	if (Array.isArray(value)) return value.length === 0
	if (isRecordValue(value)) return Object.keys(value).length === 0
	return false
}
