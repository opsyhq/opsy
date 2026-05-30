import { Hono } from "hono"
import { validate } from "../lib/validation"
import { getResourceTypeArtifacts } from "../resources/artifacts"
import type { AppEnv } from "../types"
import { schemaService } from "."
import {
	getIntegrationSchemaQuery,
	getProviderDetailQuery,
	getProviderOnboardingQuery,
	getTypeArtifactsQuery,
	getTypeSchemaQuery,
	searchTypesQuery,
} from "./schemas"

export const providersRoutes = new Hono<AppEnv>()
	.get("/", async (c) => c.json(await schemaService.listProviders()))
	.get(
		"/:provider/integration-schema",
		validate("query", getIntegrationSchemaQuery),
		async (c) =>
			c.json(
				await schemaService.getIntegrationSchema(
					c.req.param("provider"),
					c.req.valid("query"),
				),
			),
	)
	.get(
		"/:provider/onboarding/:onboardingKind",
		validate("query", getProviderOnboardingQuery),
		async (c) =>
			c.json(
				await schemaService.getProviderOnboarding(
					c.req.param("provider"),
					c.req.param("onboardingKind"),
					c.req.valid("query"),
				),
			),
	)
	.get("/:provider", validate("query", getProviderDetailQuery), async (c) =>
		c.json(
			await schemaService.getProvider(
				c.req.param("provider"),
				c.req.valid("query"),
			),
		),
	)
	.get("/:provider/types", validate("query", searchTypesQuery), async (c) => {
		const query = c.req.valid("query")
		return c.json(
			await schemaService.search(c.get("actor"), {
				...query,
				provider: c.req.param("provider"),
			}),
		)
	})
	.get("/:provider/types/:type/identity", async (c) =>
		c.json(
			await schemaService.getTypeIdentity(
				c.req.param("provider"),
				c.req.param("type"),
			),
		),
	)
	.get(
		"/:provider/types/:type",
		validate("query", getTypeSchemaQuery),
		async (c) =>
			c.json(
				await schemaService.getType(
					c.req.param("provider"),
					c.req.param("type"),
					c.req.valid("query"),
				),
			),
	)
	.get(
		"/:provider/types/:type/artifacts",
		validate("query", getTypeArtifactsQuery),
		async (c) => {
			const { kind } = c.req.valid("query")
			const artifacts = await getResourceTypeArtifacts({
				provider: c.req.param("provider"),
				kind,
				type: c.req.param("type"),
			})
			return c.json(artifacts)
		},
	)
