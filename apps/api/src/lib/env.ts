import { tmpdir } from "node:os"
import { join } from "node:path"
import { z } from "zod"

const envSchema = z.object({
	DATABASE_URL: z.string().min(1),
	PORT: z.coerce.number().default(4000),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	LOG_LEVEL: z
		.enum(["fatal", "error", "warn", "info", "debug", "trace"])
		.default("info"),
	BETTER_AUTH_SECRET: z.string().min(32),
	// AES-256-GCM key for encrypting integration credentials at rest.
	// Base64 for exactly 32 bytes — generate with `openssl rand -base64 32`.
	// Required with no fallback so a misconfigured deploy fails closed at
	// boot instead of silently persisting plaintext credentials. Validated
	// and decoded here so the 32-byte invariant lives at one boundary; the
	// rest of the app consumes the decoded key.
	CREDENTIALS_ENCRYPTION_KEY: z
		.string()
		.refine((v) => Buffer.from(v, "base64").length === 32, {
			message:
				"CREDENTIALS_ENCRYPTION_KEY must be base64 for exactly 32 bytes (generate: openssl rand -base64 32)",
		})
		.transform((v) => Buffer.from(v, "base64")),
	BETTER_AUTH_URL: z.url(),
	// Origin where the web app is served. Used by Better Auth as the
	// absolute target for redirects that need to land on the frontend
	// (loginPage, consentPage, deviceAuthorization.verificationUri,
	// magic-link / verify-email / OAuth callback URLs). Conceptually
	// distinct from CORS_ORIGIN, even though they happen to share the
	// same value in dev.
	WEB_URL: z.url(),
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),
	AUTH_SKIP: z
		.enum(["true", "false"])
		.default("false")
		.transform((v) => v === "true"),
	// Stub actor identity used only when AUTH_SKIP is enabled (dev/test). No
	// hard-coded default: a misconfigured AUTH_SKIP=true must fail closed at
	// boot rather than silently inventing an identity. The referenced
	// user/org/member rows are seeded out of band via `bun run db:seed:auth-skip`
	// — the request path never creates DB rows.
	AUTH_SKIP_USER_ID: z.uuid().optional(),
	AUTH_SKIP_ORG_ID: z.uuid().optional(),
	OPSY_SUPER_ADMIN_EMAILS: z
		.string()
		.default("")
		.transform((value) =>
			value
				.split(",")
				.map((email) => email.trim().toLowerCase())
				.filter(Boolean),
		),
	// Allowed origins for CORS requests to the API. Comma-separated; NOT
	// used as a redirect target — see WEB_URL for that.
	CORS_ORIGIN: z
		.string()
		.default("http://localhost:3000")
		.transform((v) =>
			v
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean),
		),
	MAX_REQUEST_BODY_SIZE: z.coerce.number().default(1_048_576), // 1MB
	DB_POOL_MAX: z.coerce.number().default(10),
	DB_IDLE_TIMEOUT: z.coerce.number().default(30), // seconds
	WORKFLOW_TARGET_WORLD: z.string().default("@workflow/world-postgres"),
	WORKFLOW_POSTGRES_URL: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.string().min(1).optional(),
	),
	WORKFLOW_POSTGRES_WORKER_CONCURRENCY: z.coerce.number().default(100),
	WORKFLOW_POSTGRES_MAX_POOL_SIZE: z.coerce.number().default(10),
	OPSY_BRIDGE_BIN: z.string().min(1),
	OPSY_PROVIDER_DIR: z.string().min(1),
	OPSY_SCHEMA_CACHE_DIR: z
		.string()
		.min(1)
		.default(join(tmpdir(), "opsy-schema-cache")),
	// Optional comma-separated Terraform runtime allowlist. Entries use
	// `name=source@version` or `source@version`; use `|` for multiple
	// allowed versions, for example:
	// `aws=hashicorp/aws@6.44.0|6.45.0,null=hashicorp/null@3.2.3`.
	OPSY_TERRAFORM_PROVIDERS: z.string().default("aws=hashicorp/aws@6.44.0"),
	// Optional AWS assume-role onboarding principal. This is integration-form
	// metadata only; AWS execution still flows through the Terraform bridge.
	OPSY_AWS_PRINCIPAL_ARN: z.string().min(1).optional(),
	// Optional at boot: model-backed catalog enrichment is best-effort.
	// Environments without model credentials can still serve Terraform-backed forms.
	OPENAI_API_KEY: z.string().min(1).optional(),
	AZURE_OPENAI_API_KEY: z.string().min(1).optional(),
	AZURE_OPENAI_RESOURCE_NAME: z.string().min(1).optional(),
	// Optional S3-backed asset store for provider resource icons. When unset,
	// icon enrichment remains a no-op and the UI falls back to provider logos.
	OPSY_ASSETS_S3_BUCKET: z.string().min(1).optional(),
	OPSY_ASSETS_S3_REGION: z.string().min(1).default("us-east-1"),
	// Optional. When unset, auth email senders log to the pino logger
	// (local dev without AWS creds). Region + credentials come from the
	// SDK's default chain, not this schema.
	SES_FROM_ADDRESS: z.string().optional(),
})

export const env = envSchema
	.superRefine((cfg, ctx) => {
		// AUTH_SKIP is only usable if the stub actor identity is configured.
		// Fail closed at boot instead of falling back to a baked-in UUID.
		if (!cfg.AUTH_SKIP) return
		if (!cfg.AUTH_SKIP_USER_ID) {
			ctx.addIssue({
				code: "custom",
				path: ["AUTH_SKIP_USER_ID"],
				message: "AUTH_SKIP_USER_ID is required when AUTH_SKIP=true",
			})
		}
		if (!cfg.AUTH_SKIP_ORG_ID) {
			ctx.addIssue({
				code: "custom",
				path: ["AUTH_SKIP_ORG_ID"],
				message: "AUTH_SKIP_ORG_ID is required when AUTH_SKIP=true",
			})
		}
	})
	.parse(process.env)
