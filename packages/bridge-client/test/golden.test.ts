/**
 * Golden roundtrip test: for each JSON file under test/golden/, parse it with
 * the matching generated Zod schema and assert it passes.
 *
 * This catches drift between Go structs and the generated TS schemas:
 *   - If a Go struct field is added/renamed, the golden JSON changes and this
 *     test fails until the TS schema is regenerated via `make gen-wire`.
 *   - If a field is removed from the Go struct, the golden JSON will miss it
 *     and the Go golden test will fail (see bridge/wiretest/golden_test.go).
 */
import { expect, test } from "bun:test"
import { join } from "node:path"
import type { ZodTypeAny } from "zod"
import {
	DataSourceReadRequestSchema,
	DataSourceReadResponseSchema,
	DiagnosticSchema,
	ErrorResponseSchema,
	ImportedResourceSchema,
	ProviderConfigSchemaRequestSchema,
	ProviderConfigSchemaResponseSchema,
	ProviderMetadataRequestSchema,
	ProviderMetadataResponseSchema,
	ProviderRefSchema,
	ProviderServerCapabilitiesSchema,
	ProviderSummaryRequestSchema,
	ProviderSummaryResponseSchema,
	ProviderTypeResolveRequestSchema,
	ProviderTypeResolveResponseSchema,
	ProviderTypeSchemaRequestSchema,
	ProviderTypeSchemaResponseSchema,
	ProviderTypesSearchRequestSchema,
	ProviderTypesSearchResponseSchema,
	ProviderValidateRequestSchema,
	ResourceApplyRequestSchema,
	ResourceApplyResponseSchema,
	ResourceImportRequestSchema,
	ResourceImportResponseSchema,
	ResourcePlanRequestSchema,
	ResourcePlanResponseSchema,
	ResourceReadRequestSchema,
	ResourceReadResponseSchema,
	ResourceSchemaSchema,
	ResourceValidateRequestSchema,
	SchemaAttributeSchema,
	ValidateResponseSchema,
} from "../src/wire"

// Registry mapping golden filename (without .json) → Zod schema.
const SCHEMA_REGISTRY: Record<string, ZodTypeAny> = {
	DataSourceReadRequest: DataSourceReadRequestSchema,
	DataSourceReadResponse: DataSourceReadResponseSchema,
	Diagnostic: DiagnosticSchema,
	ErrorResponse: ErrorResponseSchema,
	ImportedResource: ImportedResourceSchema,
	ProviderMetadataRequest: ProviderMetadataRequestSchema,
	ProviderMetadataResponse: ProviderMetadataResponseSchema,
	ProviderRef: ProviderRefSchema,
	ProviderConfigSchemaRequest: ProviderConfigSchemaRequestSchema,
	ProviderConfigSchemaResponse: ProviderConfigSchemaResponseSchema,
	ProviderServerCapabilities: ProviderServerCapabilitiesSchema,
	ProviderSummaryRequest: ProviderSummaryRequestSchema,
	ProviderSummaryResponse: ProviderSummaryResponseSchema,
	ProviderTypeResolveRequest: ProviderTypeResolveRequestSchema,
	ProviderTypeResolveResponse: ProviderTypeResolveResponseSchema,
	ProviderTypesSearchRequest: ProviderTypesSearchRequestSchema,
	ProviderTypesSearchResponse: ProviderTypesSearchResponseSchema,
	ProviderTypeSchemaRequest: ProviderTypeSchemaRequestSchema,
	ProviderTypeSchemaResponse: ProviderTypeSchemaResponseSchema,
	ProviderValidateRequest: ProviderValidateRequestSchema,
	ResourceApplyRequest: ResourceApplyRequestSchema,
	ResourceApplyResponse: ResourceApplyResponseSchema,
	ResourceImportRequest: ResourceImportRequestSchema,
	ResourceImportResponse: ResourceImportResponseSchema,
	ResourcePlanRequest: ResourcePlanRequestSchema,
	ResourcePlanResponse: ResourcePlanResponseSchema,
	ResourceReadRequest: ResourceReadRequestSchema,
	ResourceReadResponse: ResourceReadResponseSchema,
	ResourceSchema: ResourceSchemaSchema,
	ResourceValidateRequest: ResourceValidateRequestSchema,
	SchemaAttribute: SchemaAttributeSchema,
	ValidateResponse: ValidateResponseSchema,
}

const goldenDir = join(import.meta.dir, "golden")

for (const [name, schema] of Object.entries(SCHEMA_REGISTRY)) {
	test(`golden: ${name} parses with generated Zod schema`, async () => {
		const filePath = join(goldenDir, `${name}.json`)
		const file = Bun.file(filePath)
		const exists = await file.exists()
		expect(exists).toBe(true)

		const json = await file.json()
		// Should not throw — if it does, the schema doesn't match the golden fixture.
		expect(() => schema.parse(json)).not.toThrow()
		const parsed = schema.parse(json)
		expect(parsed).toBeDefined()
	})
}
