import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

export type JsonSchemaProp = {
	type?: string
	title?: string
	description?: string
	enum?: string[]
	const?: string
	default?: unknown
	additionalProperties?: boolean
	properties?: Record<string, JsonSchemaProp>
	required?: string[]
	oneOf?: JsonSchemaProp[]
	anyOf?: JsonSchemaProp[]
}

const SECRET_HINT = /secret|password|token/i

function humanize(name: string): string {
	return name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
}

export function defaultsFromSchema(
	schema: JsonSchemaProp | null | undefined,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(schema?.properties ?? {}).flatMap(([name, prop]) =>
			prop.default === undefined ? [] : [[name, prop.default]],
		),
	)
}

function discriminatorOf(branch: JsonSchemaProp): {
	field: string
	value: string
} | null {
	if (!branch.properties) return null
	for (const [name, prop] of Object.entries(branch.properties)) {
		if (typeof prop.const === "string") {
			return { field: name, value: prop.const }
		}
	}
	return null
}

function ScalarFieldInput({
	name,
	prop,
	value,
	onChange,
	placeholder,
}: {
	name: string
	prop: JsonSchemaProp
	value: string | undefined
	onChange: (v: string) => void
	placeholder?: string
}) {
	const label = prop.title ?? humanize(name)
	const help = prop.description
	if (prop.enum) {
		return (
			<div className="grid gap-2">
				<Label htmlFor={name}>{label}</Label>
				<Select value={value ?? ""} onValueChange={onChange}>
					<SelectTrigger id={name} className="w-full">
						<SelectValue
							placeholder={placeholder ?? `Select ${label.toLowerCase()}`}
						/>
					</SelectTrigger>
					<SelectContent>
						{prop.enum.map((opt) => (
							<SelectItem key={opt} value={opt}>
								{opt}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{help && (
					<p className="px-3 text-xs text-muted-foreground/70">{help}</p>
				)}
			</div>
		)
	}
	return (
		<div className="grid gap-2">
			<Label htmlFor={name}>{label}</Label>
			<Input
				id={name}
				type={SECRET_HINT.test(name) ? "password" : "text"}
				value={value ?? ""}
				onChange={(e) => onChange(e.target.value)}
				placeholder={
					placeholder ??
					(typeof prop.default === "string" ? prop.default : undefined)
				}
			/>
			{help && <p className="text-xs text-muted-foreground/70">{help}</p>}
		</div>
	)
}

function NestedObjectField({
	name,
	prop,
	value,
	onChange,
}: {
	name: string
	prop: JsonSchemaProp
	value: Record<string, unknown> | undefined
	onChange: (next: Record<string, unknown>) => void
}) {
	const label = prop.title ?? humanize(name)
	const help = prop.description
	return (
		<fieldset className="grid gap-3 rounded-md border border-border/60 p-3">
			<legend className="px-1 text-xs font-medium text-muted-foreground">
				{label}
			</legend>
			{help && <p className="text-xs text-muted-foreground/70">{help}</p>}
			<ObjectFields
				schema={prop}
				value={value ?? {}}
				onChange={onChange}
			/>
		</fieldset>
	)
}

export function ObjectFields({
	schema,
	value,
	onChange,
	skipFields = [],
	placeholder,
}: {
	schema: JsonSchemaProp
	value: Record<string, unknown>
	onChange: (next: Record<string, unknown>) => void
	skipFields?: string[]
	placeholder?: string
}) {
	const props = schema.properties ?? {}
	if (Object.keys(props).length === 0 && schema.additionalProperties) {
		return <JsonObjectEditor value={value} onChange={onChange} />
	}
	return (
		<div className="grid gap-4">
			{Object.entries(props).map(([name, prop]) => {
				if (skipFields.includes(name)) return null
				if (prop.const !== undefined) return null
				if (prop.type === "object") {
					return (
						<NestedObjectField
							key={name}
							name={name}
							prop={prop}
							value={value[name] as Record<string, unknown> | undefined}
							onChange={(nested) => onChange({ ...value, [name]: nested })}
						/>
					)
				}
				return (
					<ScalarFieldInput
						key={name}
						name={name}
						prop={prop}
						value={value[name] as string | undefined}
						onChange={(v) => onChange({ ...value, [name]: v })}
						placeholder={placeholder}
					/>
				)
			})}
		</div>
	)
}

function JsonObjectEditor({
	value,
	onChange,
}: {
	value: Record<string, unknown>
	onChange: (next: Record<string, unknown>) => void
}) {
	const [draft, setDraft] = useState(() => JSON.stringify(value, null, 2))
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		setDraft(JSON.stringify(value, null, 2))
	}, [value])

	return (
		<div className="grid gap-2">
			<Textarea
				value={draft}
				onChange={(event) => {
					const next = event.target.value
					setDraft(next)
					try {
						const parsed = JSON.parse(next) as unknown
						if (
							parsed === null ||
							Array.isArray(parsed) ||
							typeof parsed !== "object"
						) {
							setError("Enter a JSON object.")
							return
						}
						setError(null)
						onChange(parsed as Record<string, unknown>)
					} catch (err) {
						setError(err instanceof Error ? err.message : "Invalid JSON")
					}
				}}
				spellCheck={false}
				className="min-h-36 font-mono text-xs"
			/>
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	)
}

export function DiscriminatedUnion({
	schema,
	value,
	onChange,
	hideFields = {},
	preferredMode,
}: {
	schema: JsonSchemaProp
	value: Record<string, unknown>
	onChange: (next: Record<string, unknown>) => void
	hideFields?: Record<string, string[]>
	preferredMode?: string
}) {
	const tagged = (schema.oneOf ?? schema.anyOf ?? [])
		.map((branch) => ({ branch, tag: discriminatorOf(branch) }))
		.filter(
			(
				item,
			): item is {
				branch: JsonSchemaProp
				tag: { field: string; value: string }
			} => item.tag !== null,
		)
	const preferred = preferredMode
		? tagged.find(({ tag }) => tag.value === preferredMode)
		: undefined
	const sorted = preferred
		? [preferred, ...tagged.filter(({ tag }) => tag.value !== preferredMode)]
		: tagged
	const firstTag = sorted[0]?.tag
	const discField = firstTag?.field ?? ""
	const preferredValue =
		preferredMode && tagged.some(({ tag }) => tag.value === preferredMode)
			? preferredMode
			: undefined
	const current =
		(value[discField] as string | undefined) ??
		preferredValue ??
		firstTag?.value ??
		""

	useEffect(() => {
		if (firstTag && !value[firstTag.field]) {
			onChange({ ...value, [firstTag.field]: current })
		}
	}, [firstTag, current, value, onChange])

	if (sorted.length === 0) return null

	return (
		<Tabs value={current} onValueChange={(v) => onChange({ [discField]: v })}>
			<TabsList className="flex h-auto w-fit gap-2 bg-transparent p-0">
				{sorted.map(({ branch, tag }) => (
					<TabsTrigger
						key={tag.value}
						value={tag.value}
						className="h-8 rounded-full border border-border bg-transparent px-3 text-sm font-normal text-muted-foreground shadow-none data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent"
					>
						{branch.title ?? humanize(tag.value)}
					</TabsTrigger>
				))}
			</TabsList>
			{sorted.map(({ branch, tag }) => (
				<TabsContent key={tag.value} value={tag.value} className="mt-4">
					<ObjectFields
						schema={branch}
						value={value}
						onChange={onChange}
						skipFields={[tag.field, ...(hideFields[tag.value] ?? [])]}
					/>
				</TabsContent>
			))}
		</Tabs>
	)
}
