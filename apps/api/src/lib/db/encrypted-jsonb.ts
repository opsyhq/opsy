import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { customType } from "drizzle-orm/pg-core"
import { env } from "../env"

// Drizzle column type for a jsonb value that is encrypted at rest with
// AES-256-GCM. The column stays jsonb and the TypeScript type stays
// `Record<string, unknown>`, so every reader/writer is unchanged — the
// encryption is owned entirely by this codec (one source of truth for the
// at-rest representation; nobody else knows it exists).
//
// The stored value is this self-describing envelope, never the raw secret.
// `v` is a key/format version so the key can be rotated later (decrypt by
// `v`, re-encrypt at the current version) without a schema change.
//
// Decryption is fail-closed: a wrong key, tampered ciphertext, or corrupt
// payload throws rather than yielding partial or empty credentials.

const KEY_VERSION = 1
const ALGO = "aes-256-gcm"
const IV_BYTES = 12

type Envelope = { v: number; iv: string; tag: string; ct: string }

function isEnvelope(value: unknown): value is Envelope {
	return (
		typeof value === "object" &&
		value !== null &&
		"v" in value &&
		"iv" in value &&
		"tag" in value &&
		"ct" in value
	)
}

export function encryptJson(plaintext: Record<string, unknown>): Envelope {
	const iv = randomBytes(IV_BYTES)
	const cipher = createCipheriv(ALGO, env.CREDENTIALS_ENCRYPTION_KEY, iv)
	const ct = Buffer.concat([
		cipher.update(JSON.stringify(plaintext), "utf8"),
		cipher.final(),
	])
	return {
		v: KEY_VERSION,
		iv: iv.toString("base64"),
		tag: cipher.getAuthTag().toString("base64"),
		ct: ct.toString("base64"),
	}
}

export function decryptJson(envelope: Envelope): Record<string, unknown> {
	if (envelope.v !== KEY_VERSION) {
		throw new Error(
			`unsupported credential envelope version ${envelope.v} (expected ${KEY_VERSION})`,
		)
	}
	const decipher = createDecipheriv(
		ALGO,
		env.CREDENTIALS_ENCRYPTION_KEY,
		Buffer.from(envelope.iv, "base64"),
	)
	decipher.setAuthTag(Buffer.from(envelope.tag, "base64"))
	const pt = Buffer.concat([
		decipher.update(Buffer.from(envelope.ct, "base64")),
		decipher.final(),
	])
	return JSON.parse(pt.toString("utf8"))
}

// jsonb-backed so drizzle-kit sees an unchanged column type — no structural
// migration for the storage shape. toDriver mirrors drizzle's own jsonb
// codec by emitting a JSON string; fromDriver tolerates either a parsed
// object or a string depending on driver behaviour.
//
// A non-envelope value is passed through untouched. This covers a plaintext
// row written before this landed (local/dev only — production is pre-launch,
// so there is no backfill) and is the single legacy concession.
export const encryptedJsonb = customType<{
	data: Record<string, unknown>
	driverData: unknown
}>({
	dataType() {
		return "jsonb"
	},
	toDriver(value: Record<string, unknown>): string {
		return JSON.stringify(encryptJson(value))
	},
	fromDriver(value: unknown): Record<string, unknown> {
		const parsed = typeof value === "string" ? JSON.parse(value) : value
		if (!isEnvelope(parsed)) {
			return (parsed ?? {}) as Record<string, unknown>
		}
		return decryptJson(parsed)
	},
})
