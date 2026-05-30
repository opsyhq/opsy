import {
	oauthProviderAuthServerMetadata,
	oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider"
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client"
import { createAuthClient } from "better-auth/client"
import type { Auth as AuthType } from "better-auth/types"
import { Hono } from "hono"
import { env } from "../lib/env"
import type { AppEnv } from "../types"
import { auth } from "./config"

// Path-appended OIDC discovery and the Better Auth catch-all both live
// under /api/auth/*, but are computed from the plugin list at module
// load time — so we materialize the handlers here and mount them ahead
// of the catch-all on the same router.

const oauthAuthServer = oauthProviderAuthServerMetadata(auth)
const openIdConfig = oauthProviderOpenIdConfigMetadata(auth)

const resourceClient = createAuthClient({
	plugins: [oauthProviderResourceClient(auth as unknown as AuthType)],
})

// `authorization_servers` must match the issuer string the auth-server
// metadata advertises (baseURL + "/api/auth"), not the bare baseURL —
// otherwise an MCP client following the discovery chain computes the
// wrong well-known URL on the second hop.
const ISSUER_URL = `${env.BETTER_AUTH_URL}/api/auth`

const oauthProtectedResource = async (): Promise<Response> => {
	const metadata = await resourceClient.getProtectedResourceMetadata({
		resource: env.BETTER_AUTH_URL,
		authorization_servers: [ISSUER_URL],
	})
	return new Response(JSON.stringify(metadata), {
		headers: { "content-type": "application/json" },
	})
}

// Mounted at the root of the app (before requireActor) so Better Auth's
// own routes and the discovery well-knowns can be reached by anonymous
// requests. Registration order matters: the more-specific path-appended
// OIDC discovery must come BEFORE the /api/auth/* catch-all because
// Hono matches in registration order.
export const authRoutes = new Hono<AppEnv>()
	.get("/api/auth/.well-known/openid-configuration", (c) =>
		openIdConfig(c.req.raw),
	)
	.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))
	.get("/.well-known/oauth-authorization-server/api/auth", (c) =>
		oauthAuthServer(c.req.raw),
	)
	.get("/.well-known/oauth-protected-resource/api/auth", () =>
		oauthProtectedResource(),
	)
