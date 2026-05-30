// Mounts `providersRoutes` on a bare Hono app with a stub actor so the tests
// don't depend on `requireActor`/env state set by sibling test files.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { errorHandler } from "@/middleware/error"
import {
	clearTerraformRuntimeCacheForTest,
	setTerraformBridgeClientForTest,
	setTerraformProviderCatalogForTest,
} from "@/provider-runtime"
import { createSchemaBridgeForTest } from "@/test/fake-bridge"
import type { AppEnv } from "@/types"
import { providersRoutes } from "../routes"

const testApp = new Hono<AppEnv>()
testApp.use("*", async (c, next) => {
	c.set("requestId", "test-request-id")
	c.set("actor", { type: "user", id: "stub", orgId: "stub" })
	await next()
})
testApp.route("/providers", providersRoutes)
testApp.onError(errorHandler)

const fakeBridge = createSchemaBridgeForTest({
	providerSource: "fakecorp/fake",
	providerVersion: "9.9.9",
	provider: {
		version: 0,
		block: {
			description: "Fake provider config block",
			attributes: {
				region: { type: "string", description: "AWS region", optional: true },
				access_key: {
					type: "string",
					description: "Creds",
					optional: true,
					sensitive: true,
				},
				secret_key: {
					type: "string",
					description: "Creds",
					optional: true,
					sensitive: true,
				},
			},
		},
	},
	resourceSchemas: {
		fake_s3_bucket: {
			version: 0,
			block: {
				description: "Manage an S3 bucket",
				attributes: {
					bucket: {
						type: "string",
						description: "bucket name",
						required: true,
					},
					id: { type: "string", description: "bucket id", computed: true },
				},
			},
		},
		fake_instance: {
			version: 0,
			block: {
				attributes: {
					ami: { type: "string", required: true, description: "AMI id" },
					instance_type: { type: "string", required: true },
					id: { type: "string", computed: true },
				},
			},
		},
		fake_instance_state: {
			version: 0,
			block: {
				description: "Manage instance state",
				deprecated: true,
				deprecation_message: "Use fake_instance status inputs instead.",
				attributes: {
					instance_id: { type: "string", required: true },
					state: { type: "string", required: true },
				},
			},
		},
		fake_db_instance: {
			version: 0,
			block: {
				attributes: {
					engine: { type: "string", required: true },
					id: { type: "string", computed: true },
				},
			},
		},
	},
	dataSourceSchemas: {
		fake_ami: {
			version: 0,
			block: {
				attributes: {
					owners: { type: "string", required: true },
					id: { type: "string", computed: true },
				},
			},
		},
		fake_instance: {
			version: 0,
			block: {
				attributes: {
					instance_id: { type: "string", required: true },
				},
			},
		},
	},
})

beforeEach(() => {
	setTerraformBridgeClientForTest(fakeBridge)
	setTerraformProviderCatalogForTest([
		{ name: "aws", source: "hashicorp/aws", versions: ["6.44.0"] },
		{ name: "fake", source: "fakecorp/fake", versions: ["9.9.9"] },
	])
})

afterEach(() => {
	setTerraformBridgeClientForTest(null)
	setTerraformProviderCatalogForTest(null)
	clearTerraformRuntimeCacheForTest()
})

describe("GET /providers", () => {
	test("returns registered providers with counts from the schema", async () => {
		const res = await testApp.request("/providers")
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			providers: Array<{
				name: string
				source: string
				version: string | null
				versions: string[]
				resourceCount: number
				dataSourceCount: number
			}>
		}
		const fake = body.providers.find((p) => p.name === "fake")
		expect(fake).toBeDefined()
		expect(fake!.source).toBe("fakecorp/fake")
		expect(fake!.version).toBe("9.9.9")
		expect(fake!.versions).toEqual(["9.9.9"])
		expect(fake!.resourceCount).toBe(4)
		expect(fake!.dataSourceCount).toBe(2)
	})
})

describe("GET /providers/:provider", () => {
	test("returns provider block schema (compact by default) with descriptions stripped", async () => {
		const res = await testApp.request("/providers/fake")
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			schema: {
				identity: {
					description?: string
					fields: Array<{ name: { terraformName: string }; description?: string; sensitive?: boolean }>
				}
			}
		}
		expect(body.schema.identity.description).toBeUndefined()
		const regionField = body.schema.identity.fields.find(
			(f) => f.name.terraformName === "region",
		)
		expect(regionField?.description).toBeUndefined()
		const accessKeyField = body.schema.identity.fields.find(
			(f) => f.name.terraformName === "access_key",
		)
		expect(accessKeyField?.sensitive).toBe(true)
	})

	test("format=detailed keeps descriptions", async () => {
		const res = await testApp.request("/providers/fake?format=detailed")
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			schema: {
				identity: {
					description?: string
					fields: Array<{ name: { terraformName: string }; description?: string }>
				}
			}
		}
		expect(body.schema.identity.description).toBe("Fake provider config block")
		const regionField = body.schema.identity.fields.find(
			(f) => f.name.terraformName === "region",
		)
		expect(regionField?.description).toBe("AWS region")
	})

	test("unknown provider → 400", async () => {
		const res = await testApp.request("/providers/nope")
		expect(res.status).toBe(400)
		const body = (await res.json()) as { error: string }
		expect(body.error).toContain("unknown provider")
	})
})

describe("GET /providers/:provider/types", () => {
	test("preserves bridge search ordering without API-side reranking", async () => {
		const res = await testApp.request("/providers/fake/types?q=instance")
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			results: Array<{
				provider: string
				type: string
				kinds: string[]
			}>
			truncated: boolean
		}
		expect(body.results[0]?.type).toBe("fake_db_instance")
		expect(
			body.results.find((hit) => hit.type === "fake_instance")?.kinds.sort(),
		).toEqual(["data", "resource"])
		expect(body.results[0]).not.toHaveProperty("icons")
	})

	test("kind-specific search includes type display artifacts", async () => {
		const res = await testApp.request(
			"/providers/fake/types?q=instance&kind=resource",
		)
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			results: Array<{
				description?: string
				deprecated?: boolean
				deprecationMessage?: string
				artifacts: {
					icon: {
						data: { assetKey: string; url: string } | null
						artifactId: string | null
						status: string | null
					}
					metadata: {
						data: { name: string; display: string } | null
						artifactId: string | null
						status: string | null
					}
				}
			}>
		}
		expect(body.results[0]?.artifacts.icon.data).toBeNull()
		expect([
			"pending",
			"running",
			"ready",
			"rejected",
			"failed",
			"superseded",
			null,
		]).toContain(body.results[0]?.artifacts.icon?.status ?? null)
		const instanceState = body.results.find(
			(hit) => hit.description === "Manage instance state",
		)
		expect(instanceState).toMatchObject({
			description: "Manage instance state",
			deprecated: true,
			deprecationMessage: "Use fake_instance status inputs instead.",
		})
		expect(instanceState?.artifacts.metadata.artifactId).toEqual(
			expect.any(String),
		)
		expect(instanceState?.artifacts.metadata.status).toEqual(expect.any(String))
	})

	test("data search includes data-side metadata", async () => {
		const res = await testApp.request(
			"/providers/fake/types?q=fake_instance&kind=data",
		)
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			results: Array<{
				type: string
				artifacts: {
					icon: unknown | null
					metadata: {
						data: { name: string; display: string } | null
						artifactId: string | null
					}
				}
			}>
		}
		const hit = body.results.find((result) => result.type === "fake_instance")
		expect(hit?.artifacts.icon).toBeNull()
		expect(hit?.artifacts.metadata.artifactId).toEqual(expect.any(String))
	})

	test("tokenizes space-separated queries", async () => {
		const res = await testApp.request("/providers/fake/types?q=db%20instance")
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			results: Array<{ provider: string; type: string; kinds: string[] }>
			truncated: boolean
		}
		expect(body.results[0]?.type).toBe("fake_db_instance")
	})

	test("kind=resource drops data-only matches", async () => {
		const res = await testApp.request(
			"/providers/fake/types?q=fake_ami&kind=resource",
		)
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			results: Array<{ type: string; kinds: string[] }>
		}
		expect(body.results).toHaveLength(0)
	})

	test("kind=data narrows hybrid type to its data side", async () => {
		const res = await testApp.request(
			"/providers/fake/types?q=fake_instance&kind=data",
		)
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			results: Array<{ type: string; kinds: string[] }>
		}
		const hit = body.results.find((r) => r.type === "fake_instance")
		expect(hit).toBeDefined()
		expect(hit!.kinds).toEqual(["data"])
	})

	test("no matches returns empty results with truncated=false", async () => {
		const res = await testApp.request("/providers/fake/types?q=nonexistentxyz")
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			results: unknown[]
			truncated: boolean
		}
		expect(body.results).toHaveLength(0)
		expect(body.truncated).toBe(false)
	})

	test("limit caps results and flags truncation", async () => {
		const res = await testApp.request("/providers/fake/types?q=fake&limit=1")
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			results: unknown[]
			truncated: boolean
		}
		expect(body.results).toHaveLength(1)
		expect(body.truncated).toBe(true)
	})

	test("offset returns the next page", async () => {
		const first = await testApp.request("/providers/fake/types?q=fake&limit=2")
		const second = await testApp.request(
			"/providers/fake/types?q=fake&limit=2&offset=2",
		)
		expect(first.status).toBe(200)
		expect(second.status).toBe(200)
		const firstBody = (await first.json()) as {
			results: Array<{ type: string }>
			truncated: boolean
		}
		const secondBody = (await second.json()) as {
			results: Array<{ type: string }>
			truncated: boolean
		}
		expect(firstBody.results).toHaveLength(2)
		expect(secondBody.results).toHaveLength(2)
		expect(firstBody.results.map((r) => r.type)).not.toEqual(
			secondBody.results.map((r) => r.type),
		)
		expect(firstBody.truncated).toBe(true)
	})

	test("limit beyond 200 → 400 validation error", async () => {
		const res = await testApp.request("/providers/fake/types?q=x&limit=9999")
		expect(res.status).toBe(400)
	})

	test("missing q → 200, lists types alphabetically up to limit", async () => {
		const res = await testApp.request("/providers/fake/types?limit=3")
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			results: Array<{ type: string }>
			truncated: boolean
		}
		expect(body.results).toHaveLength(3)
		const names = body.results.map((r) => r.type)
		expect([...names].sort()).toEqual(names)
	})
})

describe("GET /providers/:provider/types/:type", () => {
	test("returns both resource and data for a hybrid type", async () => {
		const res = await testApp.request("/providers/fake/types/fake_instance")
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			provider: string
			type: string
			kinds: string[]
			resource?: unknown
			data?: unknown
		}
		expect(body.provider).toBe("fake")
		expect(body.type).toBe("fake_instance")
		expect(body.kinds.sort()).toEqual(["data", "resource"])
		expect(body.resource).toBeDefined()
		expect(body.data).toBeDefined()
	})

	test("compact default strips descriptions on attributes", async () => {
		const res = await testApp.request("/providers/fake/types/fake_s3_bucket")
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			resource: {
				identity: {
					description?: string
					fields: Array<{ name: { terraformName: string }; description?: string; required?: boolean }>
				}
			}
		}
		expect(body.resource.identity.description).toBeUndefined()
		const bucketField = body.resource.identity.fields.find(
			(f) => f.name.terraformName === "bucket",
		)
		expect(bucketField?.description).toBeUndefined()
		expect(bucketField?.required).toBe(true)
	})

	test("format=detailed preserves descriptions", async () => {
		const res = await testApp.request(
			"/providers/fake/types/fake_s3_bucket?format=detailed",
		)
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			resource: {
				identity: {
					fields: Array<{ name: { terraformName: string }; description?: string }>
				}
			}
		}
		const bucketField = body.resource.identity.fields.find(
			(f) => f.name.terraformName === "bucket",
		)
		expect(bucketField?.description).toBe("bucket name")
	})

	test("compact strips block deprecation text while detailed preserves it", async () => {
		const compact = await testApp.request(
			"/providers/fake/types/fake_instance_state",
		)
		expect(compact.status).toBe(200)
		const compactBody = (await compact.json()) as {
			resource: {
				identity: { deprecated?: boolean; deprecationMessage?: string }
			}
		}
		expect(compactBody.resource.identity.deprecated).toBe(true)
		expect(compactBody.resource.identity.deprecationMessage).toBeUndefined()

		const detailed = await testApp.request(
			"/providers/fake/types/fake_instance_state?format=detailed",
		)
		expect(detailed.status).toBe(200)
		const detailedBody = (await detailed.json()) as {
			resource: {
				identity: { deprecated?: boolean; deprecationMessage?: string }
			}
		}
		expect(detailedBody.resource.identity.deprecated).toBe(true)
		expect(detailedBody.resource.identity.deprecationMessage).toBe(
			"Use fake_instance status inputs instead.",
		)
	})

	test("kind=data on a resource-only type → 400", async () => {
		const res = await testApp.request(
			"/providers/fake/types/fake_s3_bucket?kind=data",
		)
		expect(res.status).toBe(400)
	})

	test("unknown provider → 400", async () => {
		const res = await testApp.request("/providers/nope/types/whatever")
		expect(res.status).toBe(400)
	})

	test("unknown type on known provider → 400", async () => {
		const res = await testApp.request(
			"/providers/fake/types/fake_does_not_exist",
		)
		expect(res.status).toBe(400)
		const body = (await res.json()) as { error: string }
		expect(body.error).toContain("unknown resource type")
	})
})

describe("GET /providers/:provider/types/:type/identity", () => {
	test("returns import-id mode for known types", async () => {
		const res = await testApp.request(
			"/providers/fake/types/fake_s3_bucket/identity",
		)
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			provider: string
			type: string
			mode: string
		}
		expect(body.provider).toBe("fake")
		expect(body.type).toBe("fake_s3_bucket")
		expect(body.mode).toBe("import-id")
	})

	test("unknown provider → 400", async () => {
		const res = await testApp.request(
			"/providers/nope/types/fake_s3_bucket/identity",
		)
		expect(res.status).toBe(400)
	})

	test("unknown type → 400", async () => {
		const res = await testApp.request(
			"/providers/fake/types/fake_nonexistent/identity",
		)
		expect(res.status).toBe(400)
	})
})

describe("GET /providers/:provider/integration-schema", () => {
	test("returns AWS credential branches with source.const discriminator", async () => {
		const res = await testApp.request("/providers/aws/integration-schema")
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			provider: string
			providerSource: string
			providerVersion: string
			credentialDiscriminator: string | null
			credentialForm: {
				preferredMode?: string
				createHiddenFieldsByMode?: Record<string, string[]>
				createGeneratedFieldsByMode?: Record<
					string,
					Record<string, { kind: string }>
				>
			} | null
			onboarding: {
				kind: string
				externalIdField: string
				title: string
				description: string
				externalIdLabel: string
				principalLabel: string
				documentLabel: string
				unavailableMessage: string
			} | null
			credentials: {
				oneOf?: Array<{
					properties: Record<
						string,
						{ const?: string; type?: string; pattern?: string }
					>
					required: string[]
				}>
				anyOf?: Array<{
					properties: Record<
						string,
						{ const?: string; type?: string; pattern?: string }
					>
					required: string[]
				}>
			} | null
			config: {
				properties: Record<
					string,
					{ type?: string; pattern?: string; default?: string }
				>
				required: string[]
			} | null
		}

		expect(body.provider).toBe("aws")
		expect(body.providerSource).toBe("hashicorp/aws")
		expect(body.providerVersion).toBe("6.44.0")
		expect(body.credentialDiscriminator).toBe("source")
		expect(body.credentialForm).toEqual({
			preferredMode: "assume_role",
			createHiddenFieldsByMode: { assume_role: ["external_id"] },
			createGeneratedFieldsByMode: {
				assume_role: { external_id: { kind: "uuid" } },
			},
		})
		expect(body.onboarding).toMatchObject({
			kind: "assume_role_trust_policy",
			externalIdField: "external_id",
			externalIdLabel: "External ID",
			principalLabel: "Opsy principal ARN",
			documentLabel: "Trust policy",
		})
		const branches = body.credentials?.oneOf ?? body.credentials?.anyOf ?? []
		expect(branches).toHaveLength(2)
		const sources = branches
			.map((b) => b.properties.source?.const)
			.sort()
		expect(sources).toEqual(["assume_role", "static"])
		const staticBranch = branches.find(
			(b) => b.properties.source?.const === "static",
		)
		expect(staticBranch?.required.sort()).toEqual([
			"access_key",
			"secret_key",
			"source",
		])
		const assumeRoleBranch = branches.find(
			(b) => b.properties.source?.const === "assume_role",
		)
		expect(assumeRoleBranch?.required.sort()).toEqual(["role_arn", "source"])
		expect(body.config?.properties.region.type).toBe("string")
		expect(body.config?.properties.region.pattern).toBeDefined()
		expect(body.config?.properties.region.default).toBe("us-east-1")
		expect(body.config?.required).toEqual(["region"])
	})

	test("provider with no integration catalog entry gets open object schemas", async () => {
		const res = await testApp.request("/providers/fake/integration-schema")
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			provider: string
			providerSource: string
			providerVersion: string
			credentials: Record<string, unknown>
			config: Record<string, unknown>
			credentialDiscriminator: string | null
			credentialForm: Record<string, unknown> | null
			onboarding: { kind: string } | null
		}
		expect(body.provider).toBe("fake")
		expect(body.providerSource).toBe("fakecorp/fake")
		expect(body.providerVersion).toBe("9.9.9")
		expect(body.credentials).toEqual({
			type: "object",
			additionalProperties: true,
		})
		expect(body.config).toEqual({
			type: "object",
			additionalProperties: true,
		})
		expect(body.credentialDiscriminator).toBeNull()
		expect(body.credentialForm).toBeNull()
		expect(body.onboarding).toBeNull()
	})

	test("unknown provider → 400", async () => {
		const res = await testApp.request("/providers/nope/integration-schema")
		expect(res.status).toBe(400)
	})
})

describe("GET /providers/:provider/onboarding/:onboardingKind", () => {
	const validId = "11111111-2222-4333-8444-555555555555"
	const originalArn = process.env.OPSY_AWS_PRINCIPAL_ARN

	afterEach(() => {
		if (originalArn === undefined) delete process.env.OPSY_AWS_PRINCIPAL_ARN
		else process.env.OPSY_AWS_PRINCIPAL_ARN = originalArn
	})

	test("returns templated trust policy when principal ARN configured", async () => {
		// env is parsed once at boot, so we can't mutate process.env mid-test —
		// instead verify via getAwsOnboarding directly using the value the
		// service already has. Skip when unset (dev).
		const arn = process.env.OPSY_AWS_PRINCIPAL_ARN
		if (!arn) {
			const res = await testApp.request(
				`/providers/aws/onboarding/assume_role_trust_policy?external_id=${validId}`,
			)
			expect(res.status).toBe(200)
			const body = (await res.json()) as {
				externalId: string
				principalArn: string | null
				document: string | null
			}
			expect(body.externalId).toBe(validId)
			expect(body.principalArn).toBeNull()
			expect(body.document).toBeNull()
			return
		}

		const res = await testApp.request(
			`/providers/aws/onboarding/assume_role_trust_policy?external_id=${validId}`,
		)
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			externalId: string
			principalArn: string | null
			document: string | null
		}
		expect(body.externalId).toBe(validId)
		expect(body.principalArn).toBe(arn)
		expect(body.document).toContain(arn)
		expect(body.document).toContain(validId)
		expect(body.document).toContain("sts:AssumeRole")
		expect(body.document).toContain("sts:ExternalId")
	})

	test("rejects non-UUID external_id with 400", async () => {
		const res = await testApp.request(
			"/providers/aws/onboarding/assume_role_trust_policy?external_id=not-a-uuid",
		)
		expect(res.status).toBe(400)
	})

	test("requires external_id query param", async () => {
		const res = await testApp.request(
			"/providers/aws/onboarding/assume_role_trust_policy",
		)
		expect(res.status).toBe(400)
	})
})
