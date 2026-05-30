import { mcpHandler } from "@better-auth/oauth-provider"
import { env } from "../lib/env"

// `issuer` and `audience` must match the JWT claims oauth-provider stamps,
// which use baseURL+basePath ("/api/auth"), not the bare baseURL. Clients
// must also pass `resource=<ISSUER>` on the token request to receive a JWT
// (otherwise oauth-provider issues an opaque token).
const ISSUER = `${env.BETTER_AUTH_URL}/api/auth`

export const mcpHttp = mcpHandler(
	{
		jwksUrl: `${ISSUER}/jwks`,
		verifyOptions: { issuer: ISSUER, audience: ISSUER },
	},
	async (_req, jwt) =>
		new Response(JSON.stringify({ userId: jwt.sub ?? null }), {
			status: 200,
			headers: { "content-type": "application/json" },
		}),
)
