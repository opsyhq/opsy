import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import type {
	ResolvedField,
	ResolvedTypeView,
} from "@/components/resource-detail/resolvedTypeView"
import {
	type FieldLayoutRow,
	isFieldLayoutGroupRow,
} from "@/components/resource-fields/fieldLayout"
import { valueAtFieldPath } from "@/components/resource-fields/fieldVisibility"
import { ResourceFieldValueRow } from "./ResourceFieldValues"

export function ResourceFieldsView({
	view,
	values,
	layoutRows,
}: {
	view: ResolvedTypeView
	values: Record<string, unknown>
	layoutRows?: readonly FieldLayoutRow[]
}) {
	if (view.fields.length === 0) {
		return (
			<p className="text-xs text-muted-foreground">
				This type has no fields to display.
			</p>
		)
	}

	const renderRow = (f: ResolvedField): ReactNode => (
		<ResourceFieldValueRow
			key={f.path}
			field={f}
			value={valueAtFieldPath(values, f.path)}
		/>
	)
	const renderLayoutRow = (row: FieldLayoutRow, index: number): ReactNode => {
		if (!isFieldLayoutGroupRow(row)) return renderRow(row)
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

	return (
		<div className="grid gap-5">
			<div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
				{(layoutRows ?? view.fields).map((row, index) =>
					renderLayoutRow(row, index),
				)}
			</div>
		</div>
	)
}

function LayoutFieldGroup({
	title,
	collapsed,
	children,
}: {
	title: string
	collapsed: boolean
	children: ReactNode
}) {
	return (
		<details className="group" open={!collapsed}>
			<summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 text-sm font-light text-muted-foreground transition-colors hover:bg-border hover:text-foreground group-open:bg-border group-open:text-foreground">
				<ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
				<span>{title}</span>
			</summary>
			<div className="divide-y divide-border border-t border-border">
				{children}
			</div>
		</details>
	)
}
