import { SearchIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { artifactStatuses, type ListFilters } from "@/lib/thinking-block-api"

type ListFiltersProps = {
	value: ListFilters
	onChange: (value: ListFilters) => void
}

export function ListFiltersBar({ value, onChange }: ListFiltersProps) {
	return (
		<div className="flex flex-col gap-2 border-y bg-muted/20 p-3 md:flex-row md:items-center">
			<Select
				value={value.searchField ?? "all"}
				onValueChange={(searchField) =>
					onChange({
						...value,
						searchField: searchField as ListFilters["searchField"],
					})
				}
			>
				<SelectTrigger className="w-full md:w-[160px]">
					<SelectValue placeholder="Search in" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Search all</SelectItem>
					<SelectItem value="blockName">Block name</SelectItem>
					<SelectItem value="artifactId">Artifact ID</SelectItem>
					<SelectItem value="identityKey">Identity key</SelectItem>
				</SelectContent>
			</Select>
			<div className="relative min-w-0 flex-1">
				<SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					aria-label="Search"
					value={value.q ?? ""}
					onChange={(event) => onChange({ ...value, q: event.target.value })}
					placeholder="Search"
					className="pl-8"
				/>
			</div>
			<Select
				value={value.status ?? "all"}
				onValueChange={(status) =>
					onChange({
						...value,
						status: status as ListFilters["status"],
					})
				}
			>
				<SelectTrigger className="w-full md:w-[150px]">
					<SelectValue placeholder="Status" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All statuses</SelectItem>
					{artifactStatuses.map((status) => (
						<SelectItem value={status} key={status}>
							{status}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}
