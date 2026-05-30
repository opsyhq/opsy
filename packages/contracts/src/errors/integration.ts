import { Data } from "effect"

export class IntegrationActiveResourcesConflict extends Data.TaggedError(
	"IntegrationActiveResourcesConflict",
)<{ slug: string }> {
	get message() {
		return `integration "${this.slug}" still has active resources — delete them first`
	}
}

export class IntegrationCreateFailed extends Data.TaggedError(
	"IntegrationCreateFailed",
) {
	get message() {
		return "failed to create integration"
	}
}

export class IntegrationDuplicateSlug extends Data.TaggedError(
	"IntegrationDuplicateSlug",
)<{ slug: string; projectSlug: string }> {
	get message() {
		return `integration with slug "${this.slug}" already exists in project ${this.projectSlug} — pick a different slug`
	}
}

export class IntegrationNoDefault extends Data.TaggedError(
	"IntegrationNoDefault",
)<{ provider: string }> {
	get message() {
		return `no default ${this.provider} integration in this project — create one with \`opsy create integration <slug> --provider ${this.provider} --default\` or pass --integration`
	}
}

export class IntegrationProviderMismatch extends Data.TaggedError(
	"IntegrationProviderMismatch",
)<{ slug: string; expected: string; actual: string }> {
	get message() {
		return `integration "${this.slug}" is a ${this.actual} integration, but a ${this.expected} integration is required here`
	}
}

export class IntegrationNotFound extends Data.TaggedError(
	"IntegrationNotFound",
)<{ id: string }> {
	get message() {
		return `integration not found: ${this.id}`
	}
}

export class IntegrationNotFoundDeleted extends Data.TaggedError(
	"IntegrationNotFoundDeleted",
)<{ id: string }> {
	get message() {
		return `integration ${this.id} not found or was deleted`
	}
}

export class IntegrationSlugNotFound extends Data.TaggedError(
	"IntegrationSlugNotFound",
)<{ slug: string; hint: string }> {
	get message() {
		return `no integration in this project with slug "${this.slug}"${this.hint ? ` — ${this.hint}` : ""}`
	}
}

export class IntegrationUnknownProvider extends Data.TaggedError(
	"IntegrationUnknownProvider",
)<{ providerName: string }> {
	get message() {
		return `unknown provider: ${this.providerName}`
	}
}

export class IntegrationCredentialsInvalid extends Data.TaggedError(
	"IntegrationCredentialsInvalid",
)<{ providerName: string; issues: string }> {
	get message() {
		return `invalid credentials for ${this.providerName}: ${this.issues}`
	}
}

export class IntegrationConfigInvalid extends Data.TaggedError(
	"IntegrationConfigInvalid",
)<{ providerName: string; issues: string }> {
	get message() {
		return `invalid config for ${this.providerName}: ${this.issues}`
	}
}

export type IntegrationError =
	| IntegrationActiveResourcesConflict
	| IntegrationConfigInvalid
	| IntegrationCreateFailed
	| IntegrationCredentialsInvalid
	| IntegrationDuplicateSlug
	| IntegrationNoDefault
	| IntegrationNotFound
	| IntegrationNotFoundDeleted
	| IntegrationProviderMismatch
	| IntegrationSlugNotFound
	| IntegrationUnknownProvider
