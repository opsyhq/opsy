import type { ComponentType } from "react"
import type { OperationDetailResponse } from "@/lib/operationReactQuery"

export type OperationDetail = OperationDetailResponse
export type Operation = OperationDetail["operation"]
export type OperationResource = OperationDetail["resource"]
export type OperationStatus = Operation["status"]

export type OperationPanelProps = {
	operation: Operation
	projectSlug: string
}

export type OperationPanelEntry = {
	status: OperationStatus
	Panel: ComponentType<OperationPanelProps>
}
