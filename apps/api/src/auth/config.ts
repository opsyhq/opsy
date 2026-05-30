import { apiKey } from "@better-auth/api-key"
import { oauthProvider } from "@better-auth/oauth-provider"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import {
	bearer,
	deviceAuthorization,
	jwt,
	magicLink,
	organization,
} from "better-auth/plugins"
import { db } from "../lib/db/client"
import * as schema from "../lib/db/schema"
import { env } from "../lib/env"
import {
	sendDeleteAccountEmail,
	sendInvitationEmail,
	sendMagicLinkEmail,
} from "./email"
import {
	assertOrgHasNoInfra,
	deleteUserOrgs,
	firstOrgForUser,
	purgeOrgExternals,
	purgeOrgFootprint,
} from "./lifecycle"

// `src/lib/db/schema/auth.ts` is GENERATED from this config by the
// Better Auth CLI. After changing any plugin/option below, regenerate:
//
//   bun run auth:generate         # rewrites src/lib/db/schema/auth.ts
//   bun run db:generate           # diffs the schema, emits a migration
//   bun run db:migrate            # applies the migration

export const auth = betterAuth({
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,
	// Allowlist for callbackURL redirect targets. WEB_URL is the canonical
	// frontend; CORS_ORIGIN's extra entries (e.g. a local web pointing at
	// a remote API) are also trusted here.
	trustedOrigins: Array.from(new Set([env.WEB_URL, ...env.CORS_ORIGIN])),

	// jwt() and oauthProvider() both register /token; the latter wins.
	disabledPaths: ["/token"],

	database: drizzleAdapter(db, { provider: "pg", schema }),

	advanced: {
		// Align Better Auth ids with our polymorphic actor_id uuid columns.
		database: { generateId: "uuid" },
		// When the API is served over HTTPS, mark session cookies
		// SameSite=None;Secure so a localhost dev frontend pointed at a
		// remote API can include them on cross-site fetches.
		...(env.BETTER_AUTH_URL.startsWith("https://") && {
			defaultCookieAttributes: { sameSite: "none", secure: true },
		}),
	},

	// Omit the google key entirely when env vars are blank — Better Auth has
	// no per-provider enabled flag and otherwise warns at startup.
	socialProviders:
		env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: env.GOOGLE_CLIENT_ID,
						clientSecret: env.GOOGLE_CLIENT_SECRET,
					},
				}
			: {},

	session: {
		// 14-day session rolled forward on every authenticated request
		// via `updateAge`. An active user (CLI or web) effectively never
		// re-logs in; a user idle for >14d has to.
		expiresIn: 60 * 60 * 24 * 14,
		updateAge: 60 * 60 * 24,
		cookieCache: { enabled: true, maxAge: 60 },
	},

	user: {
		deleteUser: {
			// Exposes POST /api/auth/delete-user. Required for GDPR Art. 17
			// (right to erasure). With sendDeleteAccountVerification set,
			// the POST /delete-user route sends a confirmation email instead
			// of deleting immediately; the user clicks the link, the API's
			// /delete-user/callback fires, and THEN beforeDelete runs and
			// the user is wiped. beforeDelete throws APIError("CONFLICT") if
			// the user still solely owns an org with infrastructure.
			enabled: true,
			sendDeleteAccountVerification: async ({ user, url }) =>
				sendDeleteAccountEmail(user.email, url),
			beforeDelete: async (u) => {
				await deleteUserOrgs(u.id)
			},
		},
	},

	databaseHooks: {
		// New users land with no org/membership and are routed to /onboarding,
		// where they pick an org name and explicitly accept the current Terms
		// and Privacy Policy. The onboarding endpoint creates the org, inserts
		// the owner member, and writes both acceptances in one transaction.
		// Session's activeOrganizationId stays null until then; session.before
		// below fills it on subsequent logins.
		session: {
			create: {
				before: async (session) => {
					const orgId = await firstOrgForUser(session.userId)
					return { data: { ...session, activeOrganizationId: orgId } }
				},
			},
		},
	},

	plugins: [
		organization({
			allowUserToCreateOrganization: true,
			creatorRole: "owner",
			// 7-day invite validity. Runtime-only — sets invitation.expiresAt at
			// creation time, so no schema change/migration. Default is 48h, which
			// is aggressively short for a teammate to act on an email invite.
			invitationExpiresIn: 60 * 60 * 24 * 7,
			// Better Auth doesn't construct invitation URLs — we point at
			// a web route the frontend implements that calls
			// authClient.organization.acceptInvitation({ invitationId }).
			sendInvitationEmail: async (data) =>
				sendInvitationEmail({
					to: data.email,
					acceptUrl: `${env.WEB_URL}/accept-invitation/${data.id}`,
					organizationName: data.organization.name,
					inviterEmail: data.inviter.user.email,
					role: data.role,
				}),
			organizationHooks: {
				// Runs inside POST /api/auth/organization/delete, AFTER the
				// owner-only permission check and BEFORE adapter.deleteOrganization
				// (which removes member + invitation + the org row). Two jobs:
				//   1. Block (CONFLICT) if the org still owns infrastructure —
				//      same rule as account deletion, so the two surfaces stay
				//      consistent.
				//   2. Purge the org-scoped rows that don't cascade from the
				//      org delete (audit_events FK is `no action`, apikey has
				//      no FK). Throwing here aborts the route before any row is
				//      touched, so a blocked delete is a no-op.
				beforeDeleteOrganization: async ({ organization: org }) => {
					await assertOrgHasNoInfra(org.id, "organization")
					await purgeOrgExternals(org.id)
					// Tombstoned (soft-deleted) projects don't block the
					// guard but still physically reference `organization`
					// (`org_id` FK is `no action`). Hard-purge the subtree
					// before Better Auth's adapter runs `DELETE FROM
					// organization`, or that delete fails half-purged.
					await purgeOrgFootprint(org.id)
				},
			},
		}),
		// Org-scoped api keys: `referenceId` becomes the org id, not user id.
		apiKey({ references: "organization" }),
		bearer(),
		// Absolute URL — Better Auth resolves relative paths against baseURL.
		deviceAuthorization({ verificationUri: `${env.WEB_URL}/device` }),
		magicLink({
			sendMagicLink: async ({ email, url }) => sendMagicLinkEmail(email, url),
		}),
		// Required prerequisite of oauthProvider — exposes /api/auth/jwks.
		jwt(),
		oauthProvider({
			// Absolute URLs for the same reason as deviceAuthorization above.
			loginPage: `${env.WEB_URL}/login`,
			consentPage: `${env.WEB_URL}/consent`,
			allowDynamicClientRegistration: true,
			allowUnauthenticatedClientRegistration: true,
			silenceWarnings: { oauthAuthServerConfig: true },
		}),
	],
})

export type Auth = typeof auth
