import { Data } from "effect"

export class ProjectActiveResourcesConflict extends Data.TaggedError(
	"ProjectActiveResourcesConflict",
)<{ slug: string }> {
	get message() {
		return `project ${this.slug} has active resources — delete them first`
	}
}

export class ProjectCreateFailed extends Data.TaggedError(
	"ProjectCreateFailed",
) {
	get message() {
		return "failed to create project"
	}
}

export class ProjectDuplicateSlug extends Data.TaggedError(
	"ProjectDuplicateSlug",
)<{ slug: string }> {
	get message() {
		return `project ${this.slug} already exists`
	}
}

export class ProjectNotFound extends Data.TaggedError("ProjectNotFound")<{
	slug: string
}> {
	get message() {
		return `project not found: ${this.slug}`
	}
}

export class ProjectUpdateFailed extends Data.TaggedError(
	"ProjectUpdateFailed",
) {
	get message() {
		return "failed to update project"
	}
}

export type ProjectError =
	| ProjectActiveResourcesConflict
	| ProjectCreateFailed
	| ProjectDuplicateSlug
	| ProjectNotFound
	| ProjectUpdateFailed
