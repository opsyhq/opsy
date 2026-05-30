import { X } from "lucide-react"
import {
	operationKindColors,
	operationStatusColors,
} from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"

export type OperationFiltersValue = {
	operationResource?: string
	operationKind?: string
	operationStatus?: string
	operationLimit?: number
}

const ANY = "__any__"

const KINDS = Object.keys(operationKindColors)
const STATUSES = Object.keys(operationStatusColors)
const LIMITS = [10, 20, 50, 100, 200]

export function OperationFilters({
	value,
	onChange,
}: {
	value: OperationFiltersValue
	onChange: (patch: Partial<OperationFiltersValue>) => void
}) {
	const hasAny =
		value.operationResource !== undefined ||
		value.operationKind !== undefined ||
		value.operationStatus !== undefined ||
		value.operationLimit !== undefined

	return (
		<div className="mb-4 flex flex-wrap items-end gap-3">
			<div className="flex flex-col gap-1">
				<Label className="text-xs">Kind</Label>
				<Select
					value={value.operationKind ?? ANY}
					onValueChange={(v) =>
						onChange({ operationKind: v === ANY ? undefined : v })
					}
				>
					<SelectTrigger size="sm" className="min-w-32">
						<SelectValue placeholder="Any" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ANY}>Any</SelectItem>
						{KINDS.map((k) => (
							<SelectItem key={k} value={k}>
								{k}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-1">
				<Label className="text-xs">Status</Label>
				<Select
					value={value.operationStatus ?? ANY}
					onValueChange={(v) =>
						onChange({ operationStatus: v === ANY ? undefined : v })
					}
				>
					<SelectTrigger size="sm" className="min-w-40">
						<SelectValue placeholder="Any" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ANY}>Any</SelectItem>
						{STATUSES.map((s) => (
							<SelectItem key={s} value={s}>
								{s.replace("_", " ")}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-1">
				<Label className="text-xs">Resource slug</Label>
				<Input
					placeholder="any"
					className="h-8 min-w-40"
					value={value.operationResource ?? ""}
					onChange={(e) =>
						onChange({ operationResource: e.target.value.trim() || undefined })
					}
				/>
			</div>

			<div className="flex flex-col gap-1">
				<Label className="text-xs">Limit</Label>
				<Select
					value={String(value.operationLimit ?? 20)}
					onValueChange={(v) => onChange({ operationLimit: Number(v) })}
				>
					<SelectTrigger size="sm" className="min-w-20">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{LIMITS.map((n) => (
							<SelectItem key={n} value={String(n)}>
								{n}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{hasAny && (
				<Button
					variant="ghost"
					size="sm"
					onClick={() =>
						onChange({
							operationResource: undefined,
							operationKind: undefined,
							operationStatus: undefined,
							operationLimit: undefined,
						})
					}
				>
					<X className="size-3.5" />
					Clear
				</Button>
			)}
		</div>
	)
}
