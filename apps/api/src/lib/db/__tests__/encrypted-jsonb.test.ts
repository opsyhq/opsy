import { describe, expect, test } from "bun:test"
import { decryptJson, encryptJson } from "@/lib/db/encrypted-jsonb"

const SECRET = {
	mode: "static",
	access_key: "AKIA0000000000000000",
	secret_key: "super-secret-value",
}

describe("encrypted-jsonb codec", () => {
	test("round-trips an object through encrypt/decrypt", () => {
		expect(decryptJson(encryptJson(SECRET))).toEqual(SECRET)
	})

	test("envelope leaks no plaintext and is non-deterministic", () => {
		const a = encryptJson(SECRET)
		const b = encryptJson(SECRET)

		// Shape is the self-describing envelope, not the secret.
		expect(Object.keys(a).sort()).toEqual(["ct", "iv", "tag", "v"])
		expect(JSON.stringify(a)).not.toContain("super-secret-value")
		expect(JSON.stringify(a)).not.toContain("AKIA")

		// Fresh IV per write → same input, different ciphertext.
		expect(a.iv).not.toBe(b.iv)
		expect(a.ct).not.toBe(b.ct)
	})

	test("fails closed on tampered ciphertext (GCM auth tag)", () => {
		const env = encryptJson(SECRET)
		const flipped = env.ct[0] === "A" ? "B" : "A"
		expect(() =>
			decryptJson({ ...env, ct: flipped + env.ct.slice(1) }),
		).toThrow()
	})

	test("fails closed on an unknown envelope version", () => {
		expect(() => decryptJson({ ...encryptJson(SECRET), v: 999 })).toThrow(
			/unsupported credential envelope version/,
		)
	})

	test("round-trips an empty object (the column's runtime default)", () => {
		expect(decryptJson(encryptJson({}))).toEqual({})
	})
})
