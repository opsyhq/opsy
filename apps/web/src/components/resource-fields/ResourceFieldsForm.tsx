import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronRight, Plus } from "lucide-react"
import { useEffect, useMemo, useRef } from "react"
import { type ControllerRenderProps, useForm } from "react-hook-form"
import { LucideFieldIcon } from "@/components/LucideFieldIcon"
import type {
	ResolvedField,
	ResolvedTypeView,
} from "@/components/resource-detail/resolvedTypeView"
import {
	type FieldLayoutRow,
	isFieldLayoutGroupRow,
} from "@/components/resource-fields/fieldLayout"
import { valueAtFieldPath } from "@/components/resource-fields/fieldVisibility"
import {
	buildResolverSchema,
	type FieldValues,
} from "@/components/resource-fields/resolverSchema"
import {
	EMPTY_REFERENCE_QUERY,
	type ResourceReferenceQuery,
	useResourceReferenceQuery,
} from "@/components/resource-fields/useResourceReferenceQuery"
import { Button } from "@/components/ui/button"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import type {
	RelatedCreateFieldRequest,
	RelatedCreateTargetEndpoint,
} from "@/lib/relatedResourceCreate"
import { selectFieldReferenceCandidates } from "@/lib/resourceRefs"
import { FieldRenderer, resolveFieldKind } from "./FieldRenderer"
import { ObjectFields } from "./kinds"
import { DeprecatedBadge, FieldHelpWrap } from "./ResourceFieldChrome"
import {
	type ResourceFieldInput,
	resolveResourceFieldInput,
	resourceFieldCollectionKind,
	valueAddress,
} from "./resourceFieldInput"
import type { BuildRelationship } from "./types"

const noop = () => {}

function shallowEqual(a: FieldValues, b: FieldValues): boolean {
	const ak = Object.keys(a)
	const bk = Object.keys(b)
	if (ak.length !== bk.length) return false
	for (const k of ak) if (a[k] !== b[k]) return false
	return true
}

// Two modes:
//   - controlled: pass `value` + `onChange`. Live values flow up on every
//     keystroke. No internal <form>, no submit handling.
//   - submittable: pass `value` (initial seed) + `id` + `onSubmit`. The
//     component wraps its body in `<form id={id}>`; external buttons trigger
//     submission via the HTML5 `form="<id>"` attribute and the validated
//     values come back through onSubmit.
type ResourceFieldsFormProps = {
	view: ResolvedTypeView
	value: FieldValues
	// Read-only seed for computed-only fields (e.g. ARN, ID), rendered through
	// the same widget the view panel uses. Editable fields seed from `value`,
	// which in edit mode is the resolved state (inputs ∪ outputs / plannedState);
	// a refetch of those resolved values re-syncs the form via the effect below.
	displayValues?: Record<string, unknown>
	projectSlug?: string
	layoutRows?: readonly FieldLayoutRow[]
	onCreateReferenceTarget?: (request: RelatedCreateFieldRequest) => void
} & (
	| {
			onChange: (next: FieldValues) => void
			id?: undefined
			onSubmit?: undefined
	  }
	| {
			id: string
			onSubmit: (values: FieldValues, dirtyKeys: string[]) => void
			onChange?: undefined
	  }
)

export function ResourceFieldsForm(props: ResourceFieldsFormProps) {
	if (!props.projectSlug) {
		return (
			<ResourceFieldsFormContent
				{...props}
				referenceQuery={EMPTY_REFERENCE_QUERY}
			/>
		)
	}
	return <ResourceFieldsFormWithReferences {...props} />
}

function ResourceFieldsFormWithReferences(props: ResourceFieldsFormProps) {
	const referenceQuery = useResourceReferenceQuery({
		projectSlug: props.projectSlug,
		enabled: props.view.fields.length > 0,
	})
	return (
		<ResourceFieldsFormContent {...props} referenceQuery={referenceQuery} />
	)
}

function ResourceFieldsFormContent(
	props: ResourceFieldsFormProps & { referenceQuery: ResourceReferenceQuery },
) {
	const { view, value, displayValues } = props
	const { fields } = view
	const { referenceQuery, projectSlug, onCreateReferenceTarget } = props
	const readOnlyValues = displayValues ?? value

	const schema = useMemo(() => buildResolverSchema(fields), [fields])

	// Suppress the watch→onChange→reset feedback loop: when we propagate a
	// value upward, the parent re-renders with the same `value`, which would
	// trigger reset. Skip the reset whenever the incoming `value` matches the
	// last emission we sent.
	const lastEmittedRef = useRef<FieldValues>(value)

	const form = useForm<FieldValues>({
		resolver: zodResolver(schema),
		defaultValues: value,
		mode: "onBlur",
	})

	// RHF's formState is a Proxy that only tracks properties read during
	// render. Destructure here so dirtyFields is live at submit time.
	const { dirtyFields } = form.formState

	const onChange = props.onChange
	useEffect(() => {
		if (!onChange) return
		const sub = form.watch((vals) => {
			const next = vals as FieldValues
			if (shallowEqual(next, lastEmittedRef.current)) return
			lastEmittedRef.current = next
			onChange(next)
		})
		return () => sub.unsubscribe()
	}, [form, onChange])

	// External value change (e.g. dry-run plannedState landing, parent refetch)
	// — sync into the form without bouncing back through onChange.
	// `keepDirtyValues` does the per-field merge: fields the user has touched
	// keep their value; untouched fields adopt the fresh server value. A global
	// isDirty gate would lock the whole form after a single keystroke.
	useEffect(() => {
		if (shallowEqual(value, lastEmittedRef.current)) return
		lastEmittedRef.current = value
		form.reset(value, { keepDirtyValues: true })
	}, [value, form])

	const buildRelationship = useMemo<BuildRelationship | undefined>(() => {
		if (!projectSlug) return undefined
		return (field, picker) => {
			const candidates = selectFieldReferenceCandidates({
				relationships: picker.relationships,
				resources: referenceQuery.resources,
			})
			const byKey = new Map<string, RelatedCreateTargetEndpoint>()
			for (const item of picker.relationships) {
				const endpoint = item.selectable
				byKey.set(`${endpoint.type}:${endpoint.path}`, endpoint)
			}
			const createTargets = onCreateReferenceTarget ? [...byKey.values()] : []
			return {
				relationship: picker,
				candidates,
				isLoading: referenceQuery.isLoading,
				isError: referenceQuery.isError,
				createTargets,
				onCreateTarget: onCreateReferenceTarget
					? (endpoint) =>
							onCreateReferenceTarget({
								// Identity path (dot-only), never the `[i]`/`.key`
								// value-address.
								fieldPath: field.path,
								targetEndpoint: endpoint,
								cardinality: picker.cardinality,
								values: form.getValues() as FieldValues,
							})
					: undefined,
			}
		}
	}, [
		projectSlug,
		referenceQuery.resources,
		referenceQuery.isLoading,
		referenceQuery.isError,
		onCreateReferenceTarget,
		form,
	])

	if (fields.length === 0) {
		return (
			<p className="text-xs text-muted-foreground">
				This type has no writable fields.
			</p>
		)
	}

	const renderField = (f: ResolvedField): React.ReactNode => {
		// Computed-only: seed from displayValues (live outputs) so refetched
		// outputs surface here without resetting in-flight RHF state.
		const readOnly = f.computed && !f.required && !f.optional
		const node = renderFieldControl(
			f,
			readOnly ? valueAtFieldPath(readOnlyValues, f.path) : undefined,
			readOnly,
		)
		return readOnly ? (
			<fieldset
				key={f.path}
				disabled
				className="m-0 min-w-0 border-0 p-0 opacity-60"
			>
				{node}
			</fieldset>
		) : (
			node
		)
	}

	const renderFieldControl = (
		f: ResolvedField,
		readOnlyValue: unknown,
		readOnly: boolean,
	): React.ReactNode => {
		const input = resolveResourceFieldInput(f)
		const adapt = (rhfField: ControllerRenderProps<FieldValues, string>) =>
			readOnly
				? { ...rhfField, value: readOnlyValue, onChange: noop, onBlur: noop }
				: rhfField
		if (input.kind === "field-group") {
			return (
				<FormField
					key={f.path}
					control={form.control}
					name={f.terraformName}
					render={({ field: rhfField }) => (
						<FieldGroupControl
							field={f}
							rhf={adapt(rhfField)}
							referenceQuery={referenceQuery}
							buildRelationship={buildRelationship}
						/>
					)}
				/>
			)
		}
		return (
			<FormField
				key={f.path}
				control={form.control}
				name={f.terraformName}
				render={({ field: rhfField }) => (
					<FieldRow
						field={f}
						input={input}
						rhf={adapt(rhfField)}
						referenceQuery={referenceQuery}
						buildRelationship={buildRelationship}
					/>
				)}
			/>
		)
	}

	const body = (
		<div className="grid gap-4">
			{(props.layoutRows ?? fields).map((row, index) =>
				renderLayoutRow(row, index),
			)}
		</div>
	)

	return (
		<Form {...form}>
			{props.onSubmit ? (
				<form
					id={props.id}
					onSubmit={form.handleSubmit((vals) =>
						props.onSubmit(vals as FieldValues, Object.keys(dirtyFields)),
					)}
				>
					{body}
				</form>
			) : (
				body
			)}
		</Form>
	)

	function renderLayoutRow(
		row: FieldLayoutRow,
		index: number,
	): React.ReactNode {
		if (!isFieldLayoutGroupRow(row)) return renderField(row)
		return (
			<LayoutFieldGroup
				key={`${row.title}:${index}`}
				title={row.title}
				collapsed={row.collapsed !== false}
			>
				{row.rows.map((child, childIndex) =>
					renderLayoutRow(child, childIndex),
				)}
			</LayoutFieldGroup>
		)
	}
}

function FieldRow({
	field,
	input,
	rhf,
	referenceQuery,
	buildRelationship,
}: {
	field: ResolvedField
	input: Exclude<ResourceFieldInput, { kind: "field-group" }>
	rhf: ControllerRenderProps<FieldValues, string>
	referenceQuery: ResourceReferenceQuery
	buildRelationship?: BuildRelationship
}) {
	const { deprecated } = field
	const kind = resolveFieldKind(field, input)
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
	const arrayRows =
		isArrayObject && Array.isArray(rhf.value) ? (rhf.value as unknown[]) : []
	const arrayMaxReached =
		isArrayObject &&
		field.maxItems !== undefined &&
		arrayRows.length >= field.maxItems

	return (
		<FormItem className="grid gap-2">
			<div className="flex min-w-0 items-center gap-1.5">
				<LucideFieldIcon icon={field.icon} />
				<FieldHelpWrap label={field.label} help={field.help}>
					<FormLabel className="min-w-0 truncate">{field.label}</FormLabel>
				</FieldHelpWrap>
				{deprecated && <DeprecatedBadge />}
				{isArrayObject && (
					<>
						{field.maxItems !== undefined && (
							<span className="text-xs text-muted-foreground tabular-nums">
								{arrayRows.length}/{field.maxItems}
							</span>
						)}
						<Button
							type="button"
							size="icon-xs"
							variant="ghost"
							className="text-muted-foreground hover:bg-transparent hover:text-foreground"
							aria-label={`Add ${field.label}`}
							disabled={arrayMaxReached}
							onClick={() => rhf.onChange([...arrayRows, {}])}
						>
							<Plus className="size-3.5" />
						</Button>
					</>
				)}
			</div>

			<div className="min-w-0">
				<FormControl>
					<FieldRenderer
						field={field}
						kind={kind}
						rhf={rhf}
						referenceCandidates={referenceQuery.candidates}
						referencesLoading={referenceQuery.isLoading}
						relationship={relationship}
						buildRelationship={buildRelationship}
					/>
				</FormControl>
			</div>

			{field.deprecationMessage && (
				<p className="text-xs text-muted-foreground/70">
					{field.deprecationMessage}
				</p>
			)}
			<FormMessage />
		</FormItem>
	)
}

function FieldGroup({
	field,
	children,
}: {
	field: ResolvedField
	children: React.ReactNode
}) {
	return (
		<div className="grid gap-3">
			<div className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
				<FieldHelpWrap label={field.label} help={field.help}>
					<span className="min-w-0 truncate">{field.label}</span>
				</FieldHelpWrap>
				{field.deprecated && <DeprecatedBadge />}
			</div>
			{field.deprecationMessage && (
				<p className="text-xs text-muted-foreground/70">
					{field.deprecationMessage}
				</p>
			)}
			<div className="grid gap-4">{children}</div>
		</div>
	)
}

// Renders an always-present inline group: a `single`/`group` block or an
// object-typed attribute. Its value is a plain object edited directly — no
// Add/Remove, no enable toggle (Terraform always materializes these). State
// is TF-native end to end, so there is no shape adapter here; a singleton
// `list`/`set` block is a collection and routes to ObjectArrayInput instead.
function FieldGroupControl({
	field,
	rhf,
	referenceQuery,
	buildRelationship,
}: {
	field: ResolvedField
	rhf: ControllerRenderProps<FieldValues, string>
	referenceQuery: ResourceReferenceQuery
	buildRelationship?: BuildRelationship
}) {
	return (
		<FieldGroup field={field}>
			<ObjectFields
				fields={field.children ?? []}
				value={rhf.value}
				onChange={rhf.onChange}
				onBlur={rhf.onBlur}
				referenceCandidates={referenceQuery.candidates}
				referencesLoading={referenceQuery.isLoading}
				sourcePath={valueAddress(undefined, { child: field })}
				buildRelationship={buildRelationship}
			/>
		</FieldGroup>
	)
}

function LayoutFieldGroup({
	title,
	collapsed,
	children,
}: {
	title: string
	collapsed: boolean
	children: React.ReactNode
}) {
	return (
		<details className="group" open={!collapsed}>
			<summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground">
				<ChevronRight className="size-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
				<span>{title}</span>
			</summary>
			<div className="mt-4 grid gap-4">{children}</div>
		</details>
	)
}
