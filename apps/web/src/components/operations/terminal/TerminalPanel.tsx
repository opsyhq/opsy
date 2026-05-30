import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { retryOperationMutationOptions } from "@/lib/operationReactQuery"
import { queryClient } from "@/lib/query"
import { JsonBlock, OperationBody } from "../OperationBody"
import type { OperationPanelProps } from "../types"

export function TerminalPanel({ operation, projectSlug }: OperationPanelProps) {
	const retry = useMutation({
		...retryOperationMutationOptions({
			id: operation.id,
			projectSlug,
			queryClient,
		}),
		onSuccess: () => toast.success("Operation retried"),
	})
	// Canceled operations can be retried; succeeded ones cannot.
	const retryable = operation.status === "canceled"
	return (
		<>
			{retryable && (
				<div className="flex gap-2">
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
			)}
			<JsonBlock title="Error" value={operation.error} />
			<OperationBody operation={operation} />
		</>
	)
}
