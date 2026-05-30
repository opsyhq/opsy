// Tagged ref errors thrown from pure AST code. The HTTP boundary maps
// them to a JSON body via the global error handler — keeps lib/refs
// framework-agnostic.

type RefErrorCode =
	| "ref_not_found"
	| "ref_target_missing"
	| "ref_not_ready"
	| "ref_path_missing"
	| "ref_cycle"
	| "ref_target_in_use"
	| "ref_invalid"

export class RefError extends Error {
	public readonly status: 400 | 409
	constructor(
		public readonly code: RefErrorCode,
		public readonly slug: string,
		public readonly detail: string,
	) {
		// Message shape preserves the existing "{code}: …" prefix so test
		// regexes (toThrow(/ref_not_found/)) keep matching.
		super(`${code}: ${detail}`)
		this.name = "RefError"
		this.status = statusOf(code)
	}
}

function statusOf(code: RefErrorCode): 400 | 409 {
	switch (code) {
		case "ref_not_found":
		case "ref_path_missing":
		case "ref_cycle":
		case "ref_invalid":
			return 400
		case "ref_target_missing":
		case "ref_not_ready":
		case "ref_target_in_use":
			return 409
	}
}
