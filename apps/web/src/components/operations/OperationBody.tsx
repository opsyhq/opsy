import { OperationRequestView } from "@/components/operations/OperationRequestView"
import { OperationSection } from "@/components/operations/OperationSection"
import { cn } from "@/lib/utils"
import type { Operation } from "./types"

// Shared scrollable JSON block reused by status panels.
export function JsonBlock({
	title,
	value,
	fill = false,
}: {
	title: string
	value: unknown
	fill?: boolean
}) {
	if (value == null) return null
	return (
		<OperationSection
			title={title}
			className={fill ? "flex-1" : undefined}
			bodyClassName={fill ? "flex min-h-0 flex-1 flex-col" : undefined}
		>
			<pre
				className={cn(
					"scrollbar-thin overflow-x-hidden overflow-y-auto p-3 font-mono text-xs whitespace-pre-wrap break-all text-muted-foreground",
					fill ? "min-h-0 flex-1" : "max-h-72",
				)}
			>
				{JSON.stringify(value, null, 2)}
			</pre>
		</OperationSection>
	)
}

// The request + result/error/approval blocks every status panel shows below
// its status-specific chrome.
export function OperationBody({ operation }: { operation: Operation }) {
	return (
		<>
			<OperationRequestView request={operation.request} />
			<JsonBlock title="Result" value={operation.result} fill />
			<JsonBlock title="Approval" value={operation.approval} />
		</>
	)
}
