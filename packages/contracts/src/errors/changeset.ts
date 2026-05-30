import { Data } from "effect"

export class ChangeSetDryRunNotSettled extends Data.TaggedError(
	"ChangeSetDryRunNotSettled",
)<{ pendingSlugs: string[] }> {
	get message() {
		return `changeset has pending dry runs for: ${this.pendingSlugs.join(", ")}`
	}
}

export class ChangeSetDryRunDeferred extends Data.TaggedError(
	"ChangeSetDryRunDeferred",
)<{ blockingSlugs: string[] }> {
	get message() {
		return `changeset has deferred dry runs blocked on: ${this.blockingSlugs.join(", ")}`
	}
}

export type ChangeSetError = ChangeSetDryRunNotSettled | ChangeSetDryRunDeferred
