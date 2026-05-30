import type { CanvasChangeSetItem } from "@/components/project-canvas/changeSetRuntime"
import type { ResourceReference } from "@/components/project-canvas/resourceRelationships"
import type { ChangeSetItem } from "@/lib/changeSetReactQuery"
import type { ProjectResource } from "@/lib/projectReactQuery"
import type { ResourceNodeNestedItem } from "./nodes/ResourceNode"

type ArchitectureResourceIdentity = Pick<
	ProjectResource,
	"id" | "slug" | "type" | "provider" | "metadata"
>

// `"staged"` is the canvasModel sentinel for create/import previews that have
// no backend row yet; everything else flows straight through from
// `ProjectResource["status"]`.
export type CanvasResourceStatus = ProjectResource["status"] | "staged"

export type ResourceLike = Omit<ArchitectureResourceIdentity, "metadata"> & {
	status: CanvasResourceStatus
	metadata?:
		| ArchitectureResourceIdentity["metadata"]
		| Record<string, unknown>
		| null
	inputs: Record<string, unknown> | null
	identity?: unknown
	references: ResourceReference[]
	position: { x: number; y: number } | null
	size: { w: number; h: number } | null
	topEdgeItems?: ResourceNodeNestedItem[]
	bottomTuckedItems?: ResourceNodeNestedItem[]
	componentHostSlug?: string | null
	stagedItem?: ChangeSetItem
}

export type StagedResourceUpdate = {
	item: ChangeSetItem | CanvasChangeSetItem
	inputs?: Record<string, unknown>
	position?: { x: number; y: number }
}
