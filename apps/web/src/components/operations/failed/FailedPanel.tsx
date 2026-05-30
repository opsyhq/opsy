import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { retryOperationMutationOptions } from "@/lib/operationReactQuery"
import { queryClient } from "@/lib/query"
import { JsonBlock, OperationBody } from "../OperationBody"
import type { OperationPanelProps } from "../types"
import { operationErrorSummary } from "./operationErrorSummary"

export function FailedPanel({ operation, projectSlug }: OperationPanelProps) {
	const retry = useMutation({
		...retryOperationMutationOptions({
			id: operation.id,
			projectSlug,
			queryClient,
		}),
		onSuccess: () => toast.success("Operation retried"),
	})
	const summary = operationErrorSummary(operation.error)
	return (
		<>
			<div className="flex items-start gap-2">
				{summary && (
					<p className="flex-1 text-xs text-destructive">{summary.message}</p>
				)}
				<Button
					size="xs"
					variant="outline"
					onClick={() => retry.mutate()}
					disabled={retry.isPending}
					className="ml-auto font-normal"
				>
					{retry.isPending ? "Retrying..." : "Retry"}
				</Button>
			</div>
			{summary?.detail != null && (
				<JsonBlock title="Error detail" value={summary.detail} />
			)}
			<OperationBody operation={operation} />
		</>
	)
}
