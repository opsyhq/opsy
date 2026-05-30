import { useMutation } from "@tanstack/react-query"
import { Ban } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cancelOperationMutationOptions } from "@/lib/operationReactQuery"
import { queryClient } from "@/lib/query"
import { OperationBody } from "../OperationBody"
import type { OperationPanelProps } from "../types"

export function RunningPanel({ operation, projectSlug }: OperationPanelProps) {
	const cancel = useMutation({
		...cancelOperationMutationOptions({
			id: operation.id,
			projectSlug,
			queryClient,
		}),
		onSuccess: () => toast.success("Operation canceled"),
	})
	const cancellable =
		operation.status === "pending" || operation.status === "running"
	return (
		<>
			{cancellable && (
				<div className="flex gap-2">
					<Button
						size="sm"
						variant="outline"
						onClick={() => cancel.mutate()}
						disabled={cancel.isPending}
					>
						<Ban className="size-3.5" />
						{cancel.isPending ? "Canceling..." : "Cancel"}
					</Button>
				</div>
			)}
			<OperationBody operation={operation} />
		</>
	)
}
