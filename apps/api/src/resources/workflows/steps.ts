import {
	ResourceImportMissingProviderId,
	ResourceLookupNotFound,
	ResourceUpdateParentWriteFailed,
} from "@opsy/contracts/errors"
import type { PlanPayload, ResourceTypeSchema, State } from "@opsy/provider"
import { eq } from "drizzle-orm"
import {
	getIntegrationById as getIntegrationByIdService,
	getIntegrationByResourceType as getIntegrationByResourceTypeService,
} from "@/integrations"
import { db } from "@/lib/db/client"
import {
	type IntegrationRow,
	type Operation,
	type Resource,
	resources,
} from "@/lib/db/schema"
import { classifyImportError, ImportNotFoundError } from "@/lib/errors"
import { toProviderIntegration } from "@/lib/providers"
import { extractRefs } from "@/lib/refs/ast"
import {
	describeOperationError,
	markOperationFailed,
	markOperationRunning,
	markOperationSucceeded,
	notifyResourceUpdated,
	type ResourcePatch,
} from "@/operations/operations"
import {
	providerRefFromIntegration,
	providerRuntime,
} from "@/provider-runtime"
import { getSelectorWithResourceRefs } from "../references"
import type {
	ImportResourceBody,
	LookupBody,
	UpdateResourceBody,
} from "../schemas"
import {
	getInputsBySchemaFields,
	getResourceStatePatchAfterRead,
} from "../state"

type ProviderMutationKind = "create" | "update" | "delete"

export type ResourcePlan = PlanPayload & {
	// The prior state this plan was diffed against. Travels with the plan so
	// apply trusts the same baseline instead of re-reading a fresh, mismatched
	// one. Read happens once, in planResource.
	priorState: State | null
}

export async function getResourceById(
	resourceId: string | null,
): Promise<Resource> {
	"use step"

	const resource = resourceId
		? await db.query.resources.findFirst({
				where: eq(resources.id, resourceId),
			})
		: null
	if (!resource) throw new Error(`resource not found: ${resourceId}`)
	return resource
}

export async function getIntegrationById(
	projectId: string,
	integrationId: string | null,
): Promise<IntegrationRow> {
	"use step"

	if (!integrationId) {
		throw new Error("resource has no integration")
	}
	return getIntegrationByIdService(projectId, integrationId)
}

export async function getIntegrationByResourceType(
	projectId: string,
	type: string,
	slug?: string,
): Promise<IntegrationRow> {
	"use step"

	return getIntegrationByResourceTypeService(projectId, type, slug)
}

export async function getResourceSchema(
	resource: Resource,
	integration: IntegrationRow,
): Promise<ResourceTypeSchema> {
	"use step"

	const provider = await providerRuntime.require(
		providerRefFromIntegration(integration),
	)
	const schema = await provider.getSchema(resource.type, "resource")
	if (!schema) {
		throw new Error(
			`provider ${integration.provider} has no schema for resource type ${resource.type}`,
		)
	}
	return schema
}

export async function updateResourceInputs(
	operation: Operation<UpdateResourceBody>,
	resource: Resource,
): Promise<Resource> {
	"use step"

	const inputs = operation.request.inputs
	const refs = extractRefs(inputs)
	const [updated] = await db
		.update(resources)
		.set({
			inputs,
			dependsOn: refs.length > 0 ? refs : null,
		})
		.where(eq(resources.id, resource.id))
		.returning()
	if (!updated) throw new ResourceUpdateParentWriteFailed()
	await notifyResourceUpdated(updated)
	return updated
}

// Plan: Read the identity (when applicable) then call provider Plan against
// a pre-resolved config. Callers inline `$ref`s themselves and pass the
// resulting config in: review substitutes earlier-level staged-sibling
// outputs (`inlineRefsForReview`), direct workflows substitute live refs
// (`getValueWithResourceRefs`). One explicit path, no hidden ref substitution.
export async function planResource(
	integration: IntegrationRow,
	type: string,
	identity: State | null,
	config: State | null,
	mutationKind: ProviderMutationKind,
): Promise<ResourcePlan> {
	"use step"
	const providerRef = providerRefFromIntegration(integration)
	const priorState =
		mutationKind === "create" || !identity
			? null
			: (
					await providerRuntime.dispatch(
						providerRef,
						{
							kind: "Read",
							type,
							state: identity,
						},
						{ integration: toProviderIntegration(integration) },
					)
				).payload.state
	const { payload } = await providerRuntime.dispatch(
		providerRef,
		{
			kind: "Plan",
			type,
			priorState,
			proposedState: mutationKind === "delete" ? null : config,
			config: mutationKind === "delete" ? null : config,
		},
		{ integration: toProviderIntegration(integration) },
	)
	return { ...payload, priorState }
}

// Apply hands the user-consented `{config, plan}` to the provider. The
// bridge does its own ReadResource -> re-Plan -> Diverged check internally
// (`bridge/handler/resource_apply.go`); the API never re-plans on the apply
// path. Callers pass the same config that produced the plan; for
// changeset apply, that's the config persisted in `resource_plans`.
async function applyResource(
	integration: IntegrationRow,
	type: string,
	config: State | null,
	plan: ResourcePlan,
	mutationKind: ProviderMutationKind,
): Promise<State | null> {
	"use step"

	const providerRef = providerRefFromIntegration(integration)
	const { payload } = await providerRuntime.dispatch(
		providerRef,
		{
			kind: "Apply",
			type,
			priorState: plan.priorState,
			plannedState: plan.plannedState,
			plannedPrivate: plan.plannedPrivate,
			config: mutationKind === "delete" ? null : config,
			requiresReplace: plan.requiresReplace,
			actionKind: mutationKind,
		},
		{ integration: toProviderIntegration(integration) },
	)
	// Provider state is TF-native (Terraform block shape preserved end to
	// end). It serves as both `identity` and `outputs`.
	return payload.state
}

applyResource.maxRetries = 0

export { applyResource }

// Dispatch a provider Import (read-only TF import-state read) and narrow the
// returned TF-native state to the schema's declared inputs. Throws the raw
// `ImportNotFoundError` when the target doesn't exist (classified from the
// provider's not-found diagnostics) so callers choose how to surface it: apply
// wraps it as the user-facing `ResourceImportMissingProviderId`, while dry-run
// reports `action: "error"` to block the deploy before it tombstones a stub.
// `"use step"` so the workflow bundler treats the provider Import (which
// reaches the bridge subprocess / node modules) as step code and keeps it out
// of the workflow bundle. Every caller is itself a step or a route service, so
// at runtime the directive is a no-op — this runs inline and inherits the
// caller's retry boundary (apply keeps its no-retry semantics).
export async function readImportState(
	integration: IntegrationRow,
	type: string,
	identity: Record<string, string> | null,
	providerId: string | null,
): Promise<{ state: State; inputs: Record<string, unknown> | null }> {
	"use step"

	const providerRef = providerRefFromIntegration(integration)
	// The import handle for not-found classification/reporting: the raw ID, or
	// the structured identity rendered as key=value pairs.
	const importHandle =
		providerId ??
		Object.entries(identity ?? {})
			.map(([k, v]) => `${k}=${v}`)
			.join(", ")
	const { payload } = await providerRuntime
		.dispatch(
			providerRef,
			{
				kind: "Import",
				type,
				...(identity ? { identity } : { providerId: providerId ?? undefined }),
			},
			{ integration: toProviderIntegration(integration) },
		)
		.catch((err) => {
			const notFound = classifyImportError(err, importHandle)
			if (notFound) throw notFound
			throw err
		})
	const provider = await providerRuntime.require(providerRef)
	const schema = await provider.getSchema(type, "resource")
	// Provider state is TF-native (Terraform block shape preserved end to end).
	// It becomes both `identity` and `outputs`; the schema only narrows it to
	// the declared `inputs` mirror here.
	return {
		state: payload.state,
		inputs: schema
			? getInputsBySchemaFields(schema.identity.fields, payload.state)
			: null,
	}
}

// Preflight for the direct-import route service: confirm the target exists
// before any stub is persisted. Runs as a step so the provider Import (which
// reaches the bridge subprocess / node modules) stays isolated from the
// workflow bundle that statically imports this module.
export async function assertImportTargetExists(
	integration: IntegrationRow,
	type: string,
	identity: Record<string, string> | null,
	providerId: string | null,
): Promise<void> {
	"use step"

	try {
		await readImportState(integration, type, identity, providerId)
	} catch (err) {
		if (err instanceof ImportNotFoundError) {
			throw new ResourceImportMissingProviderId({
				providerId: err.providerId,
				detail: err.message,
			})
		}
		throw err
	}
}

async function importResource(
	operation: Operation<ImportResourceBody>,
	resource: Resource,
	integration: IntegrationRow,
): Promise<{ state: State; inputs: Record<string, unknown> | null }> {
	"use step"

	const body = operation.request
	try {
		return await readImportState(
			integration,
			resource.type,
			body.identity ?? null,
			body.providerId ?? null,
		)
	} catch (err) {
		if (err instanceof ImportNotFoundError) {
			throw new ResourceImportMissingProviderId({
				providerId: err.providerId,
				detail: err.message,
			})
		}
		throw err
	}
}

importResource.maxRetries = 0

export { importResource }

export async function readResourceState(
	resource: Resource,
	integration: IntegrationRow,
): Promise<State | null> {
	"use step"

	if (!resource.identity) {
		throw new Error(`resource has no identity to read: ${resource.id}`)
	}
	const { payload } = await providerRuntime.dispatch(
		providerRefFromIntegration(integration),
		{
			kind: "Read",
			type: resource.type,
			state: resource.identity,
		},
		{ integration: toProviderIntegration(integration) },
	)
	return payload.state
}

export async function getDataStateBySelector(
	projectId: string,
	body: LookupBody,
	integration: IntegrationRow,
): Promise<{ state: State }> {
	"use step"

	const selector = await getSelectorWithResourceRefs(body.selector, projectId)
	const { payload } = await providerRuntime.dispatch(
		providerRefFromIntegration(integration),
		{ kind: "ReadData", type: body.type, selector },
		{ integration: toProviderIntegration(integration) },
	)
	if (payload.state === null) {
		throw new ResourceLookupNotFound({
			detail: `no ${body.type} found for selector ${JSON.stringify(selector)}`,
		})
	}
	return { state: payload.state }
}

// Operation lifecycle steps for the resource workflows. Each one is a thin
// `"use step"` wrapper around the corresponding `mark*` writer in
// `operations.ts`. They exist because the workflow bundler tree-shakes
// imports that are only referenced inside step bodies — calling
// `markOperationFailed` directly from inside a `"use workflow"` body would
// pull `operations.ts` (and its `db` client) into the workflow VM bundle.
// Routing through these wrappers keeps the operations service out of the
// workflow bundle the same way `changesets/workflows/steps.ts` keeps
// `db` out via its step bodies.

export async function startResourceOperation<
	TRequest extends Operation["request"],
>(operation: Operation<TRequest>): Promise<Operation<TRequest>> {
	"use step"

	return markOperationRunning(operation)
}

// Update flips the resource lifecycle to `updating` in the same tx as the op
// running transition so a crash between the two can't leave the row stranded.
export async function startUpdateResourceOperation<
	TRequest extends Operation["request"],
>(operation: Operation<TRequest>): Promise<Operation<TRequest>> {
	"use step"

	return markOperationRunning(operation, { status: "updating" })
}

export async function startDeleteResourceOperation<
	TRequest extends Operation["request"],
>(operation: Operation<TRequest>): Promise<Operation<TRequest>> {
	"use step"

	return markOperationRunning(operation, { status: "deleting" })
}

// Generic close: caller chooses whether to also apply a resource patch in the
// same tx. Used by create (status="live", identity/outputs) and forget
// (deletedAt).
export async function completeResourceOperation<
	TRequest extends Operation["request"],
>(
	operation: Operation<TRequest>,
	result: Record<string, unknown>,
	resourcePatch?: ResourcePatch,
): Promise<{ operation: Operation<TRequest>; resource: Resource }> {
	"use step"

	const closed = await markOperationSucceeded(operation, result, resourcePatch)
	if (!operation.resourceId) {
		throw new Error(`operation has no resourceId: ${operation.id}`)
	}
	const resource = await db.query.resources.findFirst({
		where: eq(resources.id, operation.resourceId),
	})
	if (!resource) {
		throw new Error(`resource not found: ${operation.resourceId}`)
	}
	return { operation: closed, resource }
}

// Update success: provider state becomes both identity and outputs; status
// settles back on `live`.
export async function completeUpdateResourceOperation<
	TRequest extends Operation["request"],
>(
	operation: Operation<TRequest>,
	result: Record<string, unknown>,
	state: State | null,
): Promise<{ operation: Operation<TRequest>; resource: Resource }> {
	"use step"

	const closed = await markOperationSucceeded(operation, result, {
		status: "live",
		identity: state,
		outputs: state,
	})
	if (!operation.resourceId) {
		throw new Error(`operation has no resourceId: ${operation.id}`)
	}
	const resource = await db.query.resources.findFirst({
		where: eq(resources.id, operation.resourceId),
	})
	if (!resource) {
		throw new Error(`resource not found: ${operation.resourceId}`)
	}
	return { operation: closed, resource }
}

// Read success: derive the patch from cloud truth, apply it together with the
// op success. Read settles on `live` or `missing` depending on whether the
// cloud returned state. A no-op (deep-equal) read still closes the op but
// makes no resource write.
export async function completeReadResourceOperation<
	TRequest extends Operation["request"],
>(
	operation: Operation<TRequest>,
	resource: Resource,
	cloudState: State | null,
	schema: ResourceTypeSchema,
): Promise<{ operation: Operation<TRequest>; resource: Resource }> {
	"use step"

	const patch = getResourceStatePatchAfterRead(resource, cloudState, schema)
	const result = { resourceId: resource.id }
	if (!patch) {
		const closed = await markOperationSucceeded(operation, result)
		return { operation: closed, resource }
	}
	const closed = await markOperationSucceeded(operation, result, patch)
	const updated = await db.query.resources.findFirst({
		where: eq(resources.id, resource.id),
	})
	if (!updated) throw new Error(`resource not found: ${resource.id}`)
	return { operation: closed, resource: updated }
}

// Delete (managed) and forget close the op and soft-delete the row in one tx.
// Identity is retained for audit even after deletion.
export async function deleteResourceComplete<
	TRequest extends Operation["request"],
>(
	operation: Operation<TRequest>,
	resource: Resource,
): Promise<{ operation: Operation<TRequest>; resource: Resource }> {
	"use step"

	const deletedAt = new Date()
	const closed = await markOperationSucceeded(
		operation,
		{ resourceId: resource.id },
		{ deletedAt },
	)
	return {
		operation: closed,
		resource: { ...resource, deletedAt },
	}
}

export async function failResourceOperation<
	TRequest extends Operation["request"],
>(
	operation: Operation<TRequest>,
	error: unknown,
): Promise<Operation<TRequest>> {
	"use step"

	return markOperationFailed(operation, describeOperationError(error))
}

// Failed update/delete: revert resource.status to the last stable truth (the
// value captured before this op flipped it to updating/deleting). When
// priorStatus is null the workflow never reached the running transition, so
// no resource patch is needed.
export async function failUpdateResourceOperation<
	TRequest extends Operation["request"],
>(
	operation: Operation<TRequest>,
	error: unknown,
	priorStatus: Resource["status"] | null,
): Promise<Operation<TRequest>> {
	"use step"

	const patch: ResourcePatch | undefined =
		priorStatus && operation.resourceId ? { status: priorStatus } : undefined
	return markOperationFailed(operation, describeOperationError(error), patch)
}

// A failed create/import never materialized a real resource; its row is just
// a stub the attempt inserted (identity still NULL, status creating/importing).
// Tombstone that stub in the same tx as the operation failure: a parked stub
// keeps the (project_id, slug) partial unique index occupied and trips the
// changeset's "resource already exists" validation, which would make a failed
// create impossible to resumable-retry. Soft-deleting frees the slug so the
// next apply re-runs the create cleanly.
export async function tombstoneFailedResourceStub<
	TRequest extends Operation["request"],
>(operation: Operation<TRequest>, error: unknown): Promise<Operation<TRequest>> {
	"use step"

	const patch: ResourcePatch | undefined =
		(operation.kind === "create" || operation.kind === "import") &&
		operation.resourceId
			? { deletedAt: new Date() }
			: undefined
	return markOperationFailed(operation, describeOperationError(error), patch)
}
