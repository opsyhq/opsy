import { Data } from "effect"

// Generic fallbacks used by helper functions where the caller controls the
// message (e.g. lib/db/softDelete.ts) and for deserializing unknown variants
// off the wire without losing shape information.

export class NotFound extends Data.TaggedError("NotFound")<{
	detail: string
}> {
	get message() {
		return this.detail
	}
}

export class Conflict extends Data.TaggedError("Conflict")<{
	detail: string
}> {
	get message() {
		return this.detail
	}
}

export class InvalidInput extends Data.TaggedError("InvalidInput")<{
	detail: string
}> {
	get message() {
		return this.detail
	}
}

export class Internal extends Data.TaggedError("Internal")<{
	detail: string
}> {
	get message() {
		return this.detail
	}
}

export type CommonError = NotFound | Conflict | InvalidInput | Internal
