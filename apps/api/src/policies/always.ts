import { definePolicy } from "@opsy/provider"
import { isMutatingKind } from "./kinds"

export default definePolicy({
	id: "always",
	description: "Require approval for all mutating operations.",
	async evaluate({ action }) {
		return { required: isMutatingKind(action.kind) }
	},
})
