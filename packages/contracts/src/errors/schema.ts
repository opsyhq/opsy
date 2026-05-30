import { Data } from "effect"

export class SchemaResourceTypeNoSchema extends Data.TaggedError(
	"SchemaResourceTypeNoSchema",
)<{ providerName: string; type: string; kind: string }> {
	get message() {
		return `${this.providerName}/${this.type} has no ${this.kind} schema`
	}
}

export class SchemaTypeIdentityUnknown extends Data.TaggedError(
	"SchemaTypeIdentityUnknown",
)<{ providerName: string; type: string }> {
	get message() {
		return `unknown resource type: ${this.providerName}/${this.type}`
	}
}

export class SchemaTypeUnknown extends Data.TaggedError("SchemaTypeUnknown")<{
	providerName: string
	type: string
}> {
	get message() {
		return `unknown resource type: ${this.providerName}/${this.type}`
	}
}

export class SchemaUnknownProvider extends Data.TaggedError(
	"SchemaUnknownProvider",
)<{ name: string }> {
	get message() {
		return `unknown provider: ${this.name}`
	}
}

export class SchemaRelationshipRuleValidationFailed extends Data.TaggedError(
	"SchemaRelationshipRuleValidationFailed",
)<{ issues: readonly unknown[]; schemaHash?: string }> {
	get message() {
		return "relationship rule validation failed"
	}
}

export class SchemaRelationshipRuleGenerationUnavailable extends Data.TaggedError(
	"SchemaRelationshipRuleGenerationUnavailable",
)<{ reason: string }> {
	get message() {
		return `relationship rule generation unavailable: ${this.reason}`
	}
}

export type SchemaError =
	| SchemaRelationshipRuleGenerationUnavailable
	| SchemaRelationshipRuleValidationFailed
	| SchemaResourceTypeNoSchema
	| SchemaTypeIdentityUnknown
	| SchemaTypeUnknown
	| SchemaUnknownProvider
