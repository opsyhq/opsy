// Errors from apps/api/src/lib/providers.ts (the provider-registry helper).
// Distinct from the bridge-runtime BridgeError.

import { Data } from "effect"

export class ProviderDataSourceNotManaged extends Data.TaggedError(
	"ProviderDataSourceNotManaged",
)<{ providerName: string; type: string }> {
	get message() {
		return `${this.providerName}/${this.type} is a data source, not a managed resource`
	}
}

export class ProviderEntryNotManagedResource extends Data.TaggedError(
	"ProviderEntryNotManagedResource",
)<{ providerName: string; type: string }> {
	get message() {
		return `${this.providerName}/${this.type} is not a data source — use 'resource create' for managed resources`
	}
}

export class ProviderTypeNotFound extends Data.TaggedError(
	"ProviderTypeNotFound",
)<{ providerName: string; type: string }> {
	get message() {
		return `unknown resource type: ${this.providerName}/${this.type}`
	}
}

export class ProviderTypeUnknownLookup extends Data.TaggedError(
	"ProviderTypeUnknownLookup",
)<{ providerName: string; type: string }> {
	get message() {
		return `unknown type: ${this.providerName}/${this.type}`
	}
}

export class ProviderUnknown extends Data.TaggedError("ProviderUnknown")<{
	providerName: string
}> {
	get message() {
		return `unknown provider: ${this.providerName}`
	}
}

export class ProviderVersionUnavailable extends Data.TaggedError(
	"ProviderVersionUnavailable",
)<{
	providerName: string
	requestedVersion: string
	availableVersion: string
}> {
	get message() {
		return `provider ${this.providerName} version ${this.requestedVersion} is not available; installed version is ${this.availableVersion}`
	}
}

export class ProviderInferTypeFailed extends Data.TaggedError(
	"ProviderInferTypeFailed",
)<{ type: string }> {
	get message() {
		return `cannot infer provider from type "${this.type}" — expected <provider>_<resource>`
	}
}

export type ProviderError =
	| ProviderDataSourceNotManaged
	| ProviderEntryNotManagedResource
	| ProviderTypeNotFound
	| ProviderTypeUnknownLookup
	| ProviderUnknown
	| ProviderVersionUnavailable
	| ProviderInferTypeFailed
