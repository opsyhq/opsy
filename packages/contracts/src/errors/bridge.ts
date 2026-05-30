import { Data } from "effect"

export class BridgePhaseFailed extends Data.TaggedError("BridgePhaseFailed")<{
	phase: string
	detail: string
}> {
	get message() {
		return `${this.phase} failed: ${this.detail}`
	}
}

export type BridgeError = BridgePhaseFailed
