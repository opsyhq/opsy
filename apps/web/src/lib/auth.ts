import { apiKeyClient } from "@better-auth/api-key/client"
import { oauthProviderClient } from "@better-auth/oauth-provider/client"
import {
	deviceAuthorizationClient,
	magicLinkClient,
	organizationClient,
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
	baseURL: `${import.meta.env.VITE_API_URL}/api/auth`,
	plugins: [
		organizationClient(),
		apiKeyClient(),
		magicLinkClient(),
		// Surfaces authClient.device.{code,token,approve,deny} and the
		// callable authClient.device(...) for code verification — used by
		// the /device and /device/approve pages.
		deviceAuthorizationClient(),
		// Surfaces authClient.oauth2.consent(...) and registers an
		// onRequest hook that auto-injects the signed `oauth_query` from
		// window.location.search into oauth2 consent POSTs. Without this
		// plugin the consent endpoint can't identify which pending
		// authorization request to mark as consented.
		oauthProviderClient(),
	],
})
