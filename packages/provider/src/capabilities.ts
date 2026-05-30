// Declarative capabilities metadata for a composed provider. Computed once at
// init() time from the schema and exposed on OpsyProvider.

export interface TypeCapabilities {
	/** True when this type backs a managed resource (plan/apply/read/import). */
	resource: boolean
	/** True when this type backs a data source (readDataSource). */
	data: boolean
}

export interface ProviderCapabilities {
	resourceCount: number
	dataSourceCount: number
}

/** Thrown by dispatch when an op is invoked against a provider that lacks it. */
export class ProviderCapabilityError extends Error {
	readonly code: string
	constructor(message: string, code = "capability_unsupported") {
		super(message)
		this.name = "ProviderCapabilityError"
		this.code = code
	}
}
