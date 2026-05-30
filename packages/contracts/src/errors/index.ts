import * as Auth from "./auth"
import * as Bridge from "./bridge"
import * as ChangeSet from "./changeset"
import * as Common from "./common"
import * as Integration from "./integration"
import * as Operation from "./operation"
import * as Project from "./project"
import * as Provider from "./provider"
import * as Resource from "./resource"
import * as Schema from "./schema"

export * from "./auth"
export * from "./bridge"
export * from "./changeset"
export * from "./common"
export * from "./integration"
export * from "./operation"
export * from "./project"
export * from "./provider"
export * from "./resource"
export * from "./schema"

export type OpsyError =
	| Operation.OperationError
	| Auth.AuthError
	| Bridge.BridgeError
	| ChangeSet.ChangeSetError
	| Common.CommonError
	| Integration.IntegrationError
	| Project.ProjectError
	| Provider.ProviderError
	| Resource.ResourceError
	| Schema.SchemaError

type AnyTaggedClass = new (
	// biome-ignore lint/suspicious/noExplicitAny: registry dispatches by _tag at runtime; payload typing is handled at the call site.
	payload: any,
) => { readonly _tag: string; readonly message: string }

// Central registry of every TaggedError class. Keyed by _tag — the same string
// emitted on the wire. `deserialize` looks up the class here and re-hydrates.
const REGISTRY: Record<string, AnyTaggedClass> = {
	// Operation
	OperationApprovalChannelForbidden:
		Operation.OperationApprovalChannelForbidden,
	OperationApprovalHookMissing: Operation.OperationApprovalHookMissing,
	OperationLockAlreadyInflight: Operation.OperationLockAlreadyInflight,
	OperationNotFound: Operation.OperationNotFound,
	OperationStatusConflict: Operation.OperationStatusConflict,
	// Auth
	AuthApiKeyInvalid: Auth.AuthApiKeyInvalid,
	AuthApiKeyNoOrg: Auth.AuthApiKeyNoOrg,
	AuthDeviceCodeAccessDenied: Auth.AuthDeviceCodeAccessDenied,
	AuthDeviceCodeExpired: Auth.AuthDeviceCodeExpired,
	AuthDeviceCodeInvalidGrant: Auth.AuthDeviceCodeInvalidGrant,
	AuthDeviceCodeInvalidRequest: Auth.AuthDeviceCodeInvalidRequest,
	AuthDeviceCodePollFailed: Auth.AuthDeviceCodePollFailed,
	AuthDeviceCodeRequestFailed: Auth.AuthDeviceCodeRequestFailed,
	AuthDeviceCodeTimeout: Auth.AuthDeviceCodeTimeout,
	AuthNoActiveOrg: Auth.AuthNoActiveOrg,
	AuthOnboardingDisabled: Auth.AuthOnboardingDisabled,
	AuthOnboardingInvalidPayload: Auth.AuthOnboardingInvalidPayload,
	AuthOnboardingOrgExists: Auth.AuthOnboardingOrgExists,
	AuthUnauthorized: Auth.AuthUnauthorized,
	// Bridge
	BridgePhaseFailed: Bridge.BridgePhaseFailed,
	// Common
	NotFound: Common.NotFound,
	Conflict: Common.Conflict,
	InvalidInput: Common.InvalidInput,
	Internal: Common.Internal,
	// Integration
	IntegrationActiveResourcesConflict:
		Integration.IntegrationActiveResourcesConflict,
	IntegrationCreateFailed: Integration.IntegrationCreateFailed,
	IntegrationDuplicateSlug: Integration.IntegrationDuplicateSlug,
	IntegrationNoDefault: Integration.IntegrationNoDefault,
	IntegrationNotFound: Integration.IntegrationNotFound,
	IntegrationNotFoundDeleted: Integration.IntegrationNotFoundDeleted,
	IntegrationProviderMismatch: Integration.IntegrationProviderMismatch,
	IntegrationSlugNotFound: Integration.IntegrationSlugNotFound,
	IntegrationUnknownProvider: Integration.IntegrationUnknownProvider,
	// Project
	ProjectActiveResourcesConflict: Project.ProjectActiveResourcesConflict,
	ProjectCreateFailed: Project.ProjectCreateFailed,
	ProjectDuplicateSlug: Project.ProjectDuplicateSlug,
	ProjectNotFound: Project.ProjectNotFound,
	ProjectUpdateFailed: Project.ProjectUpdateFailed,
	// Provider
	ProviderDataSourceNotManaged: Provider.ProviderDataSourceNotManaged,
	ProviderEntryNotManagedResource: Provider.ProviderEntryNotManagedResource,
	ProviderTypeNotFound: Provider.ProviderTypeNotFound,
	ProviderTypeUnknownLookup: Provider.ProviderTypeUnknownLookup,
	ProviderUnknown: Provider.ProviderUnknown,
	ProviderVersionUnavailable: Provider.ProviderVersionUnavailable,
	ProviderInferTypeFailed: Provider.ProviderInferTypeFailed,
	// ChangeSet
	ChangeSetDryRunNotSettled: ChangeSet.ChangeSetDryRunNotSettled,
	ChangeSetDryRunDeferred: ChangeSet.ChangeSetDryRunDeferred,
	// Resource
	ResourceProviderTargetNoIdentity: Resource.ResourceProviderTargetNoIdentity,
	ResourceDuplicateSlug: Resource.ResourceDuplicateSlug,
	ResourceImportMissingProviderId: Resource.ResourceImportMissingProviderId,
	ResourceImportProjectFailed: Resource.ResourceImportProjectFailed,
	ResourceInsertFailed: Resource.ResourceInsertFailed,
	ResourceLookupNotFound: Resource.ResourceLookupNotFound,
	ResourceNotFound: Resource.ResourceNotFound,
	ResourceParentCycle: Resource.ResourceParentCycle,
	ResourceParentNotFound: Resource.ResourceParentNotFound,
	ResourceParentSelfReference: Resource.ResourceParentSelfReference,
	ResourceProjectReadFailed: Resource.ResourceProjectReadFailed,
	ResourceProjectReadMissingFailed: Resource.ResourceProjectReadMissingFailed,
	ResourceProjectTrackFailed: Resource.ResourceProjectTrackFailed,
	ResourceReservedSlug: Resource.ResourceReservedSlug,
	ResourceSoftDeleteFailed: Resource.ResourceSoftDeleteFailed,
	ResourceUpdateParentWriteFailed: Resource.ResourceUpdateParentWriteFailed,
	// Schema
	SchemaRelationshipRuleGenerationUnavailable:
		Schema.SchemaRelationshipRuleGenerationUnavailable,
	SchemaRelationshipRuleValidationFailed:
		Schema.SchemaRelationshipRuleValidationFailed,
	SchemaResourceTypeNoSchema: Schema.SchemaResourceTypeNoSchema,
	SchemaTypeIdentityUnknown: Schema.SchemaTypeIdentityUnknown,
	SchemaTypeUnknown: Schema.SchemaTypeUnknown,
	SchemaUnknownProvider: Schema.SchemaUnknownProvider,
}

// HTTP status per tag. Omitted tags fall through to 500. Status was captured
// from the original `throw new HTTPException(status, ...)` call site — see
// packages/contracts/INVENTORY.md.
const STATUS: Record<string, number> = {
	// 400 — InvalidInput
	AuthDeviceCodeInvalidRequest: 400,
	AuthDeviceCodePollFailed: 400,
	AuthDeviceCodeRequestFailed: 400,
	AuthOnboardingDisabled: 400,
	AuthOnboardingInvalidPayload: 400,
	IntegrationNoDefault: 400,
	IntegrationProviderMismatch: 400,
	IntegrationSlugNotFound: 400,
	IntegrationUnknownProvider: 400,
	InvalidInput: 400,
	ProviderDataSourceNotManaged: 400,
	ProviderEntryNotManagedResource: 400,
	ProviderTypeNotFound: 400,
	ProviderTypeUnknownLookup: 400,
	ProviderUnknown: 400,
	ProviderVersionUnavailable: 400,
	ProviderInferTypeFailed: 400,
	ResourceParentCycle: 400,
	ResourceParentSelfReference: 400,
	ResourceReservedSlug: 400,
	SchemaRelationshipRuleValidationFailed: 400,
	SchemaResourceTypeNoSchema: 400,
	SchemaTypeIdentityUnknown: 400,
	SchemaTypeUnknown: 400,
	SchemaUnknownProvider: 400,
	// 401
	AuthApiKeyInvalid: 401,
	AuthDeviceCodeExpired: 401,
	AuthDeviceCodeInvalidGrant: 401,
	AuthUnauthorized: 401,
	// 403
	OperationApprovalChannelForbidden: 403,
	AuthDeviceCodeAccessDenied: 403,
	AuthApiKeyNoOrg: 403,
	AuthNoActiveOrg: 403,
	// 404 — NotFound
	OperationNotFound: 404,
	IntegrationNotFound: 404,
	IntegrationNotFoundDeleted: 404,
	NotFound: 404,
	ProjectNotFound: 404,
	ResourceImportMissingProviderId: 404,
	ResourceLookupNotFound: 404,
	ResourceNotFound: 404,
	ResourceParentNotFound: 404,
	// 409 — Conflict
	OperationApprovalHookMissing: 409,
	OperationLockAlreadyInflight: 409,
	OperationStatusConflict: 409,
	AuthOnboardingOrgExists: 409,
	Conflict: 409,
	IntegrationActiveResourcesConflict: 409,
	IntegrationDuplicateSlug: 409,
	ProjectActiveResourcesConflict: 409,
	ProjectDuplicateSlug: 409,
	ResourceProviderTargetNoIdentity: 409,
	ResourceDuplicateSlug: 409,
	ChangeSetDryRunNotSettled: 409,
	ChangeSetDryRunDeferred: 409,
	// 502 — bridge failures
	BridgePhaseFailed: 502,
	// 503 — service unavailable
	SchemaRelationshipRuleGenerationUnavailable: 503,
	// everything else defaults to 500 Internal
}

interface SerializedError {
	_tag: string
	message: string
	[field: string]: unknown
}

// Pulls the payload fields off a TaggedError instance, preserving its tag and
// rendered message. Used on the wire and for structured logging.
export function serialize(err: OpsyError): SerializedError {
	const record = err as unknown as Record<string, unknown>
	const { _tag, message, ...rest } = record
	return {
		_tag: err._tag,
		message: err.message,
		...rest,
	}
}

// Re-hydrate a serialized error off the wire. Returns null for unknown tags
// so callers can fall through to a generic Internal variant rather than throw.
export function deserialize(obj: SerializedError): OpsyError | null {
	const Klass = REGISTRY[obj._tag]
	if (!Klass) return null
	const { _tag: _t, message: _m, ...payload } = obj
	return new Klass(payload as Record<string, unknown>) as unknown as OpsyError
}

// Wire-side hydrator: validates shape and dispatches to `deserialize`. Returns
// null for non-objects, missing tag/message fields, and unknown tags — callers
// can fall through to whatever generic-error path they have.
export function tryDeserialize(obj: unknown): OpsyError | null {
	if (!obj || typeof obj !== "object") return null
	const o = obj as Record<string, unknown>
	if (typeof o._tag !== "string" || typeof o.message !== "string") return null
	return deserialize(o as SerializedError)
}

interface ToHttpResult {
	status: number
	body: SerializedError
}

// Maps an OpsyError to an HTTP response. Status comes from the STATUS map
// (populated from the inventory capture); unknown tags default to 500.
export function toHttp(err: OpsyError): ToHttpResult {
	return {
		status: STATUS[err._tag] ?? 500,
		body: serialize(err),
	}
}

// Runtime predicate keyed off the REGISTRY — any thrown value whose `_tag`
// matches a registered TaggedError class is an Opsy error. The boundary
// error handler uses this to route via `toHttp`.
export function isOpsyError(err: unknown): err is OpsyError {
	if (!err || typeof err !== "object") return false
	const tag = (err as { _tag?: unknown })._tag
	return typeof tag === "string" && tag in REGISTRY
}
