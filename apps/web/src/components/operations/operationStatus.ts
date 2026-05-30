import type { ProjectOperation } from "@/lib/projectReactQuery"

export const OPEN_OPERATION_STATUSES = [
	"pending",
	"running",
	"awaiting_approval",
	"canceling",
] as const

export function isOpen(status: ProjectOperation["status"]): boolean {
	return OPEN_OPERATION_STATUSES.includes(
		status as (typeof OPEN_OPERATION_STATUSES)[number],
	)
}
