import { describe, expect, test } from "bun:test"
import { CliError } from "@core/errors"
import { readJsonFlag, readSelector, readValues } from "@core/inputs/resolve"
import type { FsDep } from "@core/types/deps"

function missingFileFs(): FsDep {
	return {
		readFileSync(path: string): string {
			const err = new Error(`ENOENT: no such file or directory, open '${path}'`)
			Object.assign(err, { code: "ENOENT" })
			throw err
		},
	}
}

describe("readJsonFlag", () => {
	test("@file read errors are wrapped with flag-specific CliError details", () => {
		expect(() => readValues(missingFileFs(), "@/tmp/missing.json")).toThrow(
			CliError,
		)
		try {
			readValues(missingFileFs(), "@/tmp/missing.json")
		} catch (err) {
			expect(err).toBeInstanceOf(CliError)
			expect((err as CliError).code).toBe("INVALID_VALUES")
			expect((err as Error).message).toContain("unable to read --values file")
			expect((err as Error).message).toContain("/tmp/missing.json")
			expect((err as CliError).hint).toContain("pass inline JSON to --values")
		}
	})

	test("query selector errors mention --selector instead of --values", () => {
		try {
			readSelector(missingFileFs(), "@/tmp/selector.json")
		} catch (err) {
			expect(err).toBeInstanceOf(CliError)
			expect((err as CliError).code).toBe("INVALID_SELECTOR")
			expect((err as Error).message).toContain("unable to read --selector file")
			expect((err as CliError).hint).toContain("pass inline JSON to --selector")
		}
	})

	test("credentials and config callers get their flag name in read errors", () => {
		for (const flag of ["--credentials", "--config"]) {
			try {
				readJsonFlag(missingFileFs(), "@/tmp/secret.json", flag)
			} catch (err) {
				expect(err).toBeInstanceOf(CliError)
				expect((err as Error).message).toContain(`unable to read ${flag} file`)
				expect((err as CliError).hint).toContain(`pass inline JSON to ${flag}`)
			}
		}
	})

	test("inline invalid JSON still reports invalid JSON", () => {
		expect(() => readValues(missingFileFs(), "{bad}")).toThrow(
			"invalid --values JSON",
		)
	})
})
