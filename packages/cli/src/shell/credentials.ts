import {
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { CONFIG_DIR } from "./config"

export interface StoredCredentials {
	/** Better Auth session bearer issued by the device flow. */
	token: string
	/** ISO 8601. Server-reported `expires_at` if known, otherwise an
	 *  optimistic default. We never gate behaviour on this — Better Auth
	 *  sessions auto-refresh on use, and we surface the eventual 401 to the
	 *  user. */
	expiresAt: string
	user: {
		id: string
		email: string
		name?: string
	}
	/** activeOrganizationId from /api/auth/get-session. */
	orgId?: string
}

// Credentials live in a plain JSON file with mode 0600 — same convention as
// aws, gcloud, stripe, vercel, gh (default), and basically every other CLI.
const CREDENTIALS_PATH = join(CONFIG_DIR, ".credentials.json")

export function saveCredentials(creds: StoredCredentials): void {
	if (!existsSync(CONFIG_DIR))
		mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
	writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), {
		mode: 0o600,
	})
}

export function loadCredentials(): StoredCredentials | null {
	if (!existsSync(CREDENTIALS_PATH)) return null
	try {
		return JSON.parse(
			readFileSync(CREDENTIALS_PATH, "utf8"),
		) as StoredCredentials
	} catch {
		return null
	}
}

export function clearCredentials(): void {
	if (existsSync(CREDENTIALS_PATH)) unlinkSync(CREDENTIALS_PATH)
}

export async function getAccessToken(): Promise<string | null> {
	if (process.env.OPSY_API_KEY) return process.env.OPSY_API_KEY
	const creds = loadCredentials()
	return creds?.token ?? null
}
