import {
	AuthApiKeyInvalid,
	AuthApiKeyNoOrg,
	AuthNoActiveOrg,
	AuthUnauthorized,
} from "@opsy/contracts/errors"
import { createMiddleware } from "hono/factory"
import { auth } from "../auth"
import { env } from "../lib/env"
import type { AppEnv, AuthSessionRow } from "../types"

// Prefix used to dispatch Authorization: Bearer to the api-key path without
// a speculative session read.
const API_KEY_PREFIX = "opsy_"

/**
 * Authenticate the request and stash the resolved actor on context.
 * Authorization (which actor type / permission can do what) lives in
 * route-level guards, not here.
 */
export const requireActor = () =>
	createMiddleware<AppEnv>(async (c, next) => {
		if (env.AUTH_SKIP) {
			// IDs come from config (env.ts superRefine requires both whenever
			// AUTH_SKIP=true, so this never falls back to a baked-in UUID).
			// The referenced user/org/member rows are seeded out of band via
			// `bun run db:seed:auth-skip`; the request path never creates DB rows.
			const { AUTH_SKIP_USER_ID, AUTH_SKIP_ORG_ID } = env
			if (!AUTH_SKIP_USER_ID || !AUTH_SKIP_ORG_ID) {
				throw new AuthUnauthorized()
			}
			c.set("actor", {
				type: "user",
				id: AUTH_SKIP_USER_ID,
				orgId: AUTH_SKIP_ORG_ID,
			})
			return next()
		}

		const headers = c.req.raw.headers
		const authz = headers.get("authorization") ?? ""
		const bearer = authz.toLowerCase().startsWith("bearer ")
			? authz.slice(7)
			: null

		if (bearer?.startsWith(API_KEY_PREFIX)) {
			const result = await auth.api
				.verifyApiKey({ body: { key: bearer } })
				.catch(() => null)
			if (!result?.valid || !result.key) {
				throw new AuthApiKeyInvalid()
			}
			// `referenceId` is the org id (apiKey({ references: "organization" })).
			const orgId = result.key.referenceId
			if (!orgId) throw new AuthApiKeyNoOrg()
			let permissions: string[] = []
			if (typeof result.key.permissions === "string") {
				try {
					const parsed = JSON.parse(result.key.permissions) as unknown
					if (Array.isArray(parsed)) {
						permissions = parsed.filter(
							(p): p is string => typeof p === "string",
						)
					}
				} catch {
					// Malformed permissions json — treat as no permissions.
				}
			}
			c.set("actor", {
				type: "api_key",
				id: result.key.id,
				orgId,
				permissions,
			})
			return next()
		}

		// Session path — handles web cookies and CLI device-flow bearers via
		// the bearer() plugin. cookieCache short-circuits most web reads.
		const sessionData = await auth.api.getSession({ headers }).catch(() => null)
		if (sessionData?.session && sessionData.user) {
			const s: AuthSessionRow = sessionData.session
			if (!s.activeOrganizationId) throw new AuthNoActiveOrg()
			// Cookie header present → browser session; Bearer token → CLI device flow.
			const channel = bearer ? ("bearer" as const) : ("browser" as const)
			c.set("actor", {
				type: "user",
				id: sessionData.user.id,
				orgId: s.activeOrganizationId,
				channel,
			})
			return next()
		}

		throw new AuthUnauthorized()
	})
