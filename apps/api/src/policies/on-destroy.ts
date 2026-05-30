import { definePolicy } from "@opsy/provider"

export default definePolicy({
	id: "on_destroy",
	description: "Require approval for delete operations.",
	async evaluate({ action }) {
		return { required: action.kind === "delete" }
	},
})
