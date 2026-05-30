import { ApprovalPanel } from "./approval/ApprovalPanel"
import { FailedPanel } from "./failed/FailedPanel"
import { RunningPanel } from "./running/RunningPanel"
import { TerminalPanel } from "./terminal/TerminalPanel"
import type { OperationPanelEntry, OperationStatus } from "./types"

export const OPERATION_STATUS_REGISTRY: Record<
	OperationStatus,
	OperationPanelEntry
> = {
	pending: { status: "pending", Panel: RunningPanel },
	running: { status: "running", Panel: RunningPanel },
	canceling: { status: "canceling", Panel: RunningPanel },
	awaiting_approval: { status: "awaiting_approval", Panel: ApprovalPanel },
	failed: { status: "failed", Panel: FailedPanel },
	succeeded: { status: "succeeded", Panel: TerminalPanel },
	canceled: { status: "canceled", Panel: TerminalPanel },
}
