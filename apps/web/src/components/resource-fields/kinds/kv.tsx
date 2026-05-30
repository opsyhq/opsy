import { X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import type { FieldRendererProps } from "../types"

export function KvKind({ rhf }: FieldRendererProps) {
	const { value, onChange, onBlur } = rhf
	const obj =
		value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {}
	const entries = Object.entries(obj)
	const [draftKey, setDraftKey] = useState("")
	const [draftVal, setDraftVal] = useState("")
	return (
		<div className="grid gap-1.5">
			{entries.length > 0 && (
				<Table>
					<TableBody>
						{entries.map(([k, v]) => (
							<TableRow key={k}>
								<TableCell className="max-w-36 truncate py-1.5 font-mono text-xs">
									{k}
								</TableCell>
								<TableCell className="w-4 px-0 py-1.5 text-center text-muted-foreground">
									=
								</TableCell>
								<TableCell className="max-w-52 truncate py-1.5 font-mono text-xs text-muted-foreground">
									{String(v)}
								</TableCell>
								<TableCell className="w-7 py-1.5 pr-0 text-right">
									<Button
										type="button"
										size="icon-xs"
										variant="ghost"
										className="size-6 text-muted-foreground hover:bg-transparent hover:text-destructive"
										aria-label={`Remove ${k}`}
										onClick={() => {
											const next = { ...obj }
											delete next[k]
											onChange(
												Object.keys(next).length === 0 ? undefined : next,
											)
										}}
									>
										<X className="size-3.5" />
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
			<div className="flex items-center gap-1">
				<Input
					placeholder="key"
					value={draftKey}
					onChange={(e) => setDraftKey(e.target.value)}
				/>
				<Input
					placeholder="value"
					value={draftVal}
					onBlur={onBlur}
					onChange={(e) => setDraftVal(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && draftKey.trim()) {
							e.preventDefault()
							onChange({ ...obj, [draftKey.trim()]: draftVal })
							setDraftKey("")
							setDraftVal("")
						}
					}}
				/>
			</div>
		</div>
	)
}
