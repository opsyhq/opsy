import { Data } from "effect"

export class ResourceProviderTargetNoIdentity extends Data.TaggedError(
	"ResourceProviderTargetNoIdentity",
)<{ kind: string; slug: string }> {
	get message() {
		return `cannot ${this.kind} ${this.slug}: no provider identity handle to read against`
	}
}

export class ResourceDuplicateSlug extends Data.TaggedError(
	"ResourceDuplicateSlug",
)<{ slug: string; projectSlug: string }> {
	get message() {
		return `resource ${this.slug} already exists in project ${this.projectSlug}`
	}
}

export class ResourceImportMissingProviderId extends Data.TaggedError(
	"ResourceImportMissingProviderId",
)<{ providerId: string; detail: string }> {
	get message() {
		return `provider id ${this.providerId} not found: ${this.detail}`
	}
}

export class ResourceImportProjectFailed extends Data.TaggedError(
	"ResourceImportProjectFailed",
) {
	get message() {
		return "failed to project import result"
	}
}

export class ResourceInsertFailed extends Data.TaggedError(
	"ResourceInsertFailed",
) {
	get message() {
		return "insert returned no row"
	}
}

export class ResourceLookupNotFound extends Data.TaggedError(
	"ResourceLookupNotFound",
)<{ detail: string }> {
	get message() {
		return this.detail
	}
}

export class ResourceNotFound extends Data.TaggedError("ResourceNotFound")<{
	slug: string
	projectSlug: string
}> {
	get message() {
		return `resource ${this.slug} does not exist in project ${this.projectSlug}`
	}
}

export class ResourceParentCycle extends Data.TaggedError(
	"ResourceParentCycle",
)<{ slug: string; newParent: string }> {
	get message() {
		return `re-parenting "${this.slug}" to "${this.newParent}" creates a cycle`
	}
}

export class ResourceParentNotFound extends Data.TaggedError(
	"ResourceParentNotFound",
)<{ parent: string; projectSlug: string }> {
	get message() {
		return `parent resource "${this.parent}" not found in project ${this.projectSlug}`
	}
}

export class ResourceParentSelfReference extends Data.TaggedError(
	"ResourceParentSelfReference",
)<{ parent: string }> {
	get message() {
		return `parent "${this.parent}" cannot reference self`
	}
}

export class ResourceProjectReadFailed extends Data.TaggedError(
	"ResourceProjectReadFailed",
) {
	get message() {
		return "failed to project read result"
	}
}

export class ResourceProjectReadMissingFailed extends Data.TaggedError(
	"ResourceProjectReadMissingFailed",
) {
	get message() {
		return "failed to project read result (missing)"
	}
}

export class ResourceProjectTrackFailed extends Data.TaggedError(
	"ResourceProjectTrackFailed",
)<{ resourceId: string }> {
	get message() {
		return `failed to project track result onto ${this.resourceId}`
	}
}

export class ResourceReservedSlug extends Data.TaggedError(
	"ResourceReservedSlug",
) {
	get message() {
		return "'data' is a reserved slug — used by 'opsy resource read data' for stateless data source lookup"
	}
}

export class ResourceSoftDeleteFailed extends Data.TaggedError(
	"ResourceSoftDeleteFailed",
) {
	get message() {
		return "failed to soft-delete resource row"
	}
}

export class ResourceUpdateParentWriteFailed extends Data.TaggedError(
	"ResourceUpdateParentWriteFailed",
) {
	get message() {
		return "failed to write parent"
	}
}

export type ResourceError =
	| ResourceProviderTargetNoIdentity
	| ResourceDuplicateSlug
	| ResourceImportMissingProviderId
	| ResourceImportProjectFailed
	| ResourceInsertFailed
	| ResourceLookupNotFound
	| ResourceNotFound
	| ResourceParentCycle
	| ResourceParentNotFound
	| ResourceParentSelfReference
	| ResourceProjectReadFailed
	| ResourceProjectReadMissingFailed
	| ResourceProjectTrackFailed
	| ResourceReservedSlug
	| ResourceSoftDeleteFailed
	| ResourceUpdateParentWriteFailed
