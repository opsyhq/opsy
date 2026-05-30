import { z } from "zod"
import type { ProviderIntegrationDefinition } from "../integration"

// Broad managed policy the one-click stack attaches to the customer deploy
// role. AdministratorAccess (not PowerUserAccess) because Opsy provisions
// ECS/RDS/Route53/CloudFront, which require iam:PassRole and
// service-linked-role creation that PowerUserAccess omits.
const AWS_DEPLOY_PERMISSIONS_POLICY_ARN =
	"arn:aws:iam::aws:policy/AdministratorAccess"

const IAM_ROLE_ARN_REGEX = /^arn:aws[a-z-]*:iam::\d{12}:role\/.+/

// `strictObject` at every level: an unknown key is a parse error, not a silent
// strip. `providerConfigFor` parses against this schema, so anything outside
// these fields can never reach the real AWS provider config (no smuggled
// `endpoints`, `assume_role_with_web_identity`, `shared_credentials_files`,
// proxy, etc. via loose JSON).
const staticSourceVariant = z.strictObject({
	source: z.literal("static"),
	access_key: z.string().min(16),
	secret_key: z.string().min(1),
	session_token: z.string().min(1).optional(),
})

const assumeRoleSourceVariant = z.strictObject({
	source: z.literal("assume_role"),
	role_arn: z
		.string()
		.regex(IAM_ROLE_ARN_REGEX, "role_arn must be a valid IAM role ARN"),
	external_id: z.string().min(2).optional(),
	session_name: z.string().min(2).optional(),
})

const awsCredentialsSchema = z.discriminatedUnion("source", [
	staticSourceVariant,
	assumeRoleSourceVariant,
])

const awsConfigSchema = z.strictObject({
	region: z
		.string()
		.trim()
		.min(3)
		.max(64)
		.regex(
			/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\d+$/,
			"region must be a lowercase AWS region identifier",
		)
		.default("us-east-1"),
})

export const awsIntegrationDefinition = {
	name: "aws",
	source: "hashicorp/aws",
	credentialsSchema: awsCredentialsSchema,
	configSchema: awsConfigSchema,
	credentialDiscriminator: "source",
	credentialForm: {
		preferredMode: "assume_role",
		createHiddenFieldsByMode: { assume_role: ["external_id"] },
		createGeneratedFieldsByMode: {
			assume_role: { external_id: { kind: "uuid" } },
		},
	},
	providerConfigFor: (integration) => {
		const { region } = awsConfigSchema.parse(integration.config ?? {})
		const credentials = awsCredentialsSchema.parse(integration.credentials)
		if (credentials.source === "static") {
			return {
				region,
				access_key: credentials.access_key,
				secret_key: credentials.secret_key,
				...(credentials.session_token
					? { token: credentials.session_token }
					: {}),
			}
		}
		// assume_role: leave base credentials to the AWS SDK's default chain
		// (env, instance metadata, IRSA, sso). The role chain is the only
		// authoritative piece this integration carries.
		return {
			region,
			assume_role: [
				{
					role_arn: credentials.role_arn,
					...(credentials.external_id
						? { external_id: credentials.external_id }
						: {}),
					session_name: credentials.session_name ?? "opsy",
				},
			],
		}
	},
	summarizeCredentialMode: (credentials) => {
		const parsed = awsCredentialsSchema.parse(credentials)
		return parsed.source
	},
	onboarding: {
		kind: "assume_role_trust_policy",
		externalIdField: "external_id",
		principalEnv: "OPSY_AWS_PRINCIPAL_ARN",
		title: "AWS IAM trust setup",
		description:
			"Create an IAM role in your AWS account with the trust policy below, then paste its ARN above. The external ID is unique to this integration - it prevents another customer from tricking Opsy into assuming your role.",
		externalIdLabel: "External ID",
		principalLabel: "Opsy principal ARN",
		documentLabel: "Trust policy",
		unavailableMessage:
			"Backend AWS principal is not configured. Assume-role onboarding is unavailable in this environment.",
		documentFor: ({ principalArn, externalId }) =>
			JSON.stringify(
				{
					Version: "2012-10-17",
					Statement: [
						{
							Effect: "Allow",
							Principal: { AWS: principalArn },
							Action: "sts:AssumeRole",
							Condition: {
								StringEquals: { "sts:ExternalId": externalId },
							},
						},
					],
				},
				null,
				2,
			),
		cloudformation: {
			templateAssetKey: "cloudformation/aws-deploy-role.yaml",
			stackName: "opsy-aws-deploy-role",
			permissionsPolicyArn: AWS_DEPLOY_PERMISSIONS_POLICY_ARN,
		},
	},
} satisfies ProviderIntegrationDefinition
