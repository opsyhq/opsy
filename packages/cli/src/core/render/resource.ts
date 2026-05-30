import type { InferResponseType } from "hono/client"
import type { client } from "../../client"
import type { RenderOp } from "./ops"

export type ResourceView = InferResponseType<
	(typeof client.projects)[":project"]["resources"][":slug"]["$get"],
	200
>

// `formatResource` also renders the raw resource row attached to an operation
// result. Both shapes carry `status` and `deletedAt` — this is the minimal
// projection they share, not a parallel API type.
type RenderableResource = {
	slug: string
	type: string
	status: ResourceView["status"]
	deletedAt: string | null
}

// Soft-deletion is orthogonal to lifecycle status and outranks it for display.
export function resourceStatus(r: RenderableResource): string {
	if (r.deletedAt) return "deleted"
	return r.status
}

export function formatResource(r: RenderableResource): RenderOp[] {
	return [
		{ op: "section", title: "resource" },
		{
			op: "keyValue",
			rows: [
				["slug", r.slug],
				["type", r.type],
				["status", resourceStatus(r)],
			],
		},
	]
}
