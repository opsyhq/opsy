import { Plus, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isRecord } from "@/lib/changeDiff"
import { valueAddress } from "../resourceFieldInput"
import type { FieldRendererProps } from "../types"
import { isEmptyInputValue, ObjectFields } from "./object"

const isRecordValue = isRecord

export function ObjectMapKind({
	field,
	rhf,
	referenceAutocomplete,
	referenceCandidates,
	referencesLoading,
	onReferenceSelect,
	buildRelationship,
	sourcePath,
}: FieldRendererProps) {
	const { value, onChange, onBlur } = rhf
	const obj = isRecordValue(value) ? value : {}
	const entries = Object.entries(obj)
	const [draftKey, setDraftKey] = useState("")
	const addKey = () => {
		const key = draftKey.trim()
		if (!key || Object.hasOwn(obj, key)) return
		onChange({ ...obj, [key]: {} })
		setDraftKey("")
	}
	const updateEntry = (key: string, nextEntry: unknown) => {
		const next = { ...obj }
		if (isEmptyInputValue(nextEntry)) delete next[key]
		else next[key] = nextEntry
		onChange(Object.keys(next).length === 0 ? undefined : next)
	}
	const removeEntry = (key: string) => {
		const next = { ...obj }
		delete next[key]
		onChange(Object.keys(next).length === 0 ? undefined : next)
	}

	return (
		<div className="grid gap-2">
			{entries.map(([key, entry]) => (
				<div key={key} className="grid gap-3">
					<div className="flex items-center gap-2">
						<span className="font-mono text-xs text-muted-foreground">
							{key}
						</span>
						<Button
							type="button"
							size="icon-xs"
							variant="ghost"
							className="ml-auto text-muted-foreground hover:bg-transparent hover:text-foreground"
							aria-label={`Remove ${key}`}
							onClick={() => removeEntry(key)}
						>
							<X className="size-3.5" />
						</Button>
					</div>
					<ObjectFields
						fields={field.children ?? []}
						value={entry}
						onChange={(nextEntry) => updateEntry(key, nextEntry)}
						onBlur={onBlur}
						referenceAutocomplete={referenceAutocomplete}
						referenceCandidates={referenceCandidates}
						referencesLoading={referencesLoading}
						onReferenceSelect={onReferenceSelect}
						buildRelationship={buildRelationship}
						sourcePath={valueAddress(sourcePath ?? field.terraformName, {
							key,
						})}
					/>
				</div>
			))}
			<div className="flex items-center gap-1">
				<Input
					placeholder="key"
					value={draftKey}
					onBlur={onBlur}
					onChange={(e) => setDraftKey(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault()
							addKey()
						}
					}}
				/>
				<Button
					type="button"
					size="xs"
					variant="outline"
					className="h-7 rounded-md px-3"
					onClick={addKey}
				>
					<Plus className="size-3.5" />
					Add
				</Button>
			</div>
		</div>
	)
}
