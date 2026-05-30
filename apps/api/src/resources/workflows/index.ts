import type { Operation, Resource } from "@/lib/db/schema"
import { waitForOperationApproval } from "@/operations/approval"
import { getCachedResourcePlan } from "../dry-run"
import { getValueWithResourceRefs } from "../references"
import {
	type CreateResourceBody,
	type DeleteResourceRequest,
	type ImportResourceBody,
	type LookupBody,
	type ReadResourceRequest,
	resourceState,
	type UpdateResourceBody,
} from "../schemas"
import {
	applyResource,
	completeReadResourceOperation,
	completeResourceOperation,
	completeUpdateResourceOperation,
	deleteResourceComplete,
	failResourceOperation,
	failUpdateResourceOperation,
	getDataStateBySelector,
	getIntegrationById,
	getIntegrationByResourceType,
	getResourceById,
	getResourceSchema,
	importResource,
	planResource,
	readResourceState,
	startDeleteResourceOperation,
	startResourceOperation,
	startUpdateResourceOperation,
	tombstoneFailedResourceStub,
	updateResourceInputs,
} from "./steps"

export async function createResourceWorkflow(
	operation: Operation<CreateResourceBody>,
): Promise<{ resource: Resource } | { canceled: true }> {
	"use workflow"

	try {
		const resource = await getResourceById(operation.resourceId)
		const approval = await waitForOperationApproval(operation, resource)
		if (!approval.approved) return { canceled: true }

		const approvedOperation = approval.operation
		if (approvedOperation.request.type === undefined) {
			const completed = await completeResourceOperation(
				approvedOperation,
				{ resourceId: resource.id, resource },
				{ status: "live" },
			)
			return { resource: completed.resource }
		}

		const integration = await getIntegrationById(
			resource.projectId,
			resource.integrationId,
		)
		const config =
			resource.inputs === null
				? null
				: resourceState.parse(
						await getValueWithResourceRefs(resource.inputs, resource.projectId),
					)
		const plan = approvedOperation.changeSetItemId
			? await getCachedResourcePlan(approvedOperation.changeSetItemId)
			: await planResource(integration, resource.type, null, config, "create")
		const state = await applyResource(
			integration,
			resource.type,
			config,
			plan,
			"create",
		)
		const completed = await completeResourceOperation(
			approvedOperation,
			{ resourceId: resource.id },
			{ status: "live", identity: state, outputs: state },
		)
		return { resource: completed.resource }
	} catch (error) {
		await tombstoneFailedResourceStub(operation, error)
		throw error
	}
}

export async function updateResourceWorkflow(
	operation: Operation<UpdateResourceBody>,
): Promise<{ resource: Resource } | { canceled: true }> {
	"use workflow"

	let priorStatus: Resource["status"] | null = null
	try {
		const resource = await getResourceById(operation.resourceId)
		priorStatus = resource.status
		const approval = await waitForOperationApproval(operation, resource)
		if (!approval.approved) return { canceled: true }

		const approvedOperation = approval.operation
		const runningOperation = await startUpdateResourceOperation(approvedOperation)
		const resourceWithInputs = await updateResourceInputs(
			runningOperation,
			resource,
		)
		const integration = await getIntegrationById(
			resourceWithInputs.projectId,
			resourceWithInputs.integrationId,
		)
		const config =
			resourceWithInputs.inputs === null
				? null
				: resourceState.parse(
						await getValueWithResourceRefs(
							resourceWithInputs.inputs,
							resourceWithInputs.projectId,
						),
					)
		const plan = runningOperation.changeSetItemId
			? await getCachedResourcePlan(runningOperation.changeSetItemId)
			: await planResource(
					integration,
					resourceWithInputs.type,
					resourceWithInputs.identity,
					config,
					"update",
				)
		const state = await applyResource(
			integration,
			resourceWithInputs.type,
			config,
			plan,
			"update",
		)
		const completed = await completeUpdateResourceOperation(
			runningOperation,
			{ resourceId: resource.id },
			state,
		)
		return { resource: completed.resource }
	} catch (error) {
		await failUpdateResourceOperation(operation, error, priorStatus)
		throw error
	}
}

export async function importResourceWorkflow(
	operation: Operation<ImportResourceBody>,
): Promise<{ resource: Resource } | { canceled: true }> {
	"use workflow"

	try {
		const resource = await getResourceById(operation.resourceId)
		const approval = await waitForOperationApproval(operation, resource)
		if (!approval.approved) return { canceled: true }

		const approvedOperation = approval.operation
		const integration = await getIntegrationById(
			resource.projectId,
			resource.integrationId,
		)
		const imported = await importResource(approvedOperation, resource, integration)
		const completed = await completeResourceOperation(
			approvedOperation,
			{ resourceId: resource.id },
			{
				status: "live",
				inputs: imported.inputs,
				identity: imported.state,
				outputs: imported.state,
			},
		)
		return { resource: completed.resource }
	} catch (error) {
		await tombstoneFailedResourceStub(operation, error)
		throw error
	}
}

export async function readResourceWorkflow(
	operation: Operation<ReadResourceRequest>,
): Promise<{ resource: Resource }> {
	"use workflow"

	try {
		await startResourceOperation(operation)
		const resource = await getResourceById(operation.resourceId)
		const integration = await getIntegrationById(
			resource.projectId,
			resource.integrationId,
		)
		const schema = await getResourceSchema(resource, integration)
		const state = await readResourceState(resource, integration)
		const completed = await completeReadResourceOperation(
			operation,
			resource,
			state,
			schema,
		)
		return { resource: completed.resource }
	} catch (error) {
		await failResourceOperation(operation, error)
		throw error
	}
}

export async function deleteResourceWorkflow(
	operation: Operation<DeleteResourceRequest>,
): Promise<{ resource: Resource } | { canceled: true }> {
	"use workflow"

	let priorStatus: Resource["status"] | null = null
	try {
		const resource = await getResourceById(operation.resourceId)
		priorStatus = resource.status
		const approval = await waitForOperationApproval(operation, resource)
		if (!approval.approved) return { canceled: true }

		const approvedOperation = approval.operation
		const runningOperation = await startDeleteResourceOperation(approvedOperation)
		const integration = await getIntegrationById(
			resource.projectId,
			resource.integrationId,
		)
		const plan = runningOperation.changeSetItemId
			? await getCachedResourcePlan(runningOperation.changeSetItemId)
			: await planResource(
					integration,
					resource.type,
					resource.identity,
					null,
					"delete",
				)
		await applyResource(integration, resource.type, null, plan, "delete")
		const completed = await deleteResourceComplete(runningOperation, resource)
		return { resource: completed.resource }
	} catch (error) {
		await failUpdateResourceOperation(operation, error, priorStatus)
		throw error
	}
}

export async function forgetResourceWorkflow(
	operation: Operation<DeleteResourceRequest>,
): Promise<{ resource: Resource } | { canceled: true }> {
	"use workflow"

	try {
		const resource = await getResourceById(operation.resourceId)
		const approval = await waitForOperationApproval(operation, resource)
		if (!approval.approved) return { canceled: true }

		const approvedOperation = approval.operation
		const completed = await deleteResourceComplete(approvedOperation, resource)
		return { resource: completed.resource }
	} catch (error) {
		await failResourceOperation(operation, error)
		throw error
	}
}

export async function lookupDataWorkflow(
	operation: Operation<LookupBody>,
): Promise<{ state: unknown }> {
	"use workflow"

	try {
		await startResourceOperation(operation)
		const integration = await getIntegrationByResourceType(
			operation.projectId,
			operation.request.type,
			operation.request.integrationSlug,
		)
		const result = await getDataStateBySelector(
			operation.projectId,
			operation.request,
			integration,
		)
		await completeResourceOperation(operation, result)
		return result
	} catch (error) {
		await failResourceOperation(operation, error)
		throw error
	}
}
