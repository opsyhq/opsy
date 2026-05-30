import { createAuthClient } from "better-auth/client"
import { deviceAuthorizationClient } from "better-auth/client/plugins"
import { API_URL } from "./config"

export const authClient = createAuthClient({
	baseURL: `${API_URL}/api/auth`,
	plugins: [deviceAuthorizationClient()],
})
