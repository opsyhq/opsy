import { X } from "lucide-react"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { valueAddress } from "../resourceFieldInput"
import type { FieldRendererProps } from "../types"
import { ObjectFields } from "./object"

export function ObjectArrayKind({
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
	const rows = Array.isArray(value) ? value : []
	// A max_items==1 block is a single-instance presence ("Add Versioning",
	// capped at 1) — its one row reads as the block itself, not "Versioning 1".
	const singleton = field.maxItems === 1
	const minReached =
		field.minItems !== undefined && rows.length <= field.minItems
	const rowKeysRef = useRef<string[]>([])
	const nextRowKeyRef = useRef(0)
	while (rowKeysRef.current.length < rows.length) {
		rowKeysRef.current.push(`${field.path}:${nextRowKeyRef.current}`)
		nextRowKeyRef.current += 1
	}
	if (rowKeysRef.current.length > rows.length) {
		rowKeysRef.current.splice(rows.length)
	}
	const updateRow = (index: number, nextRow: unknown) => {
		const next = rows.slice()
		next[index] = nextRow
		onChange(next)
	}
	const removeRow = (index: number) => {
		const next = rows.slice()
		next.splice(index, 1)
		rowKeysRef.current.splice(index, 1)
		onChange(next.length === 0 ? undefined : next)
	}

	return (
		<div className="grid gap-2">
			{rows.map((row, index) => (
				<div key={rowKeysRef.current[index]} className="grid gap-3">
					<div className="flex items-center gap-2">
						<span className="text-xs font-medium text-muted-foreground">
							{singleton ? field.label : `${field.label} ${index + 1}`}
						</span>
						<Button
							type="button"
							size="icon-xs"
							variant="ghost"
							className="ml-auto text-muted-foreground hover:bg-transparent hover:text-foreground"
							aria-label={
								singleton
									? `Remove ${field.label}`
									: `Remove ${field.label} ${index + 1}`
							}
							disabled={minReached}
							onClick={() => removeRow(index)}
						>
							<X className="size-3.5" />
						</Button>
					</div>
					<ObjectFields
						fields={field.children ?? []}
						value={row}
						onChange={(nextRow) => updateRow(index, nextRow)}
						onBlur={onBlur}
						referenceAutocomplete={referenceAutocomplete}
						referenceCandidates={referenceCandidates}
						referencesLoading={referencesLoading}
						onReferenceSelect={onReferenceSelect}
						buildRelationship={buildRelationship}
						sourcePath={valueAddress(sourcePath ?? field.terraformName, {
							index,
						})}
					/>
				</div>
			))}
		</div>
	)
}
