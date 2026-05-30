import { useMutation } from "@tanstack/react-query"
import { Ban, Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
	approveOperationMutationOptions,
	cancelOperationMutationOptions,
} from "@/lib/operationReactQuery"
import { queryClient } from "@/lib/query"
import { OperationBody } from "../OperationBody"
import type { OperationPanelProps } from "../types"
import { PolicySummary } from "./PolicySummary"

export function ApprovalPanel({ operation, projectSlug }: OperationPanelProps) {
	const approve = useMutation({
		...approveOperationMutationOptions({
			id: operation.id,
			projectSlug,
			queryClient,
		}),
		onSuccess: () => toast.success("Operation approved"),
	})
	// "Reject" is cancel-from-awaiting-approval: the backend's approval
	// decision API rejects an awaiting operation by calling cancelOperation.
	const reject = useMutation({
		...cancelOperationMutationOptions({
			id: operation.id,
			projectSlug,
			queryClient,
		}),
		onSuccess: () => toast.success("Operation rejected"),
	})
	const pending = approve.isPending || reject.isPending
	return (
		<>
			<PolicySummary operation={operation} />
			<div className="flex gap-2">
				<Button size="sm" onClick={() => approve.mutate()} disabled={pending}>
					<Check className="size-3.5" />
					{approve.isPending ? "Approving..." : "Approve"}
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={() => reject.mutate()}
					disabled={pending}
				>
					<Ban className="size-3.5" />
					{reject.isPending ? "Rejecting..." : "Reject"}
				</Button>
			</div>
			<OperationBody operation={operation} />
		</>
	)
}
