import type { SearchHit } from "@opsy/api"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import {
	type Integration,
	ResourcePickerWizard,
} from "@/components/ResourcePickerWizard"
import { inferProviderFromType } from "@/components/resource-sheet/shared"
import { renderTaggedError } from "@/errors/error-toast"
import {
	type ChangeSet,
	type StageChangeSetItemBody,
	stageChangeSetItemMutationOptions,
} from "@/lib/changeSetReactQuery"
import { queryClient } from "@/lib/query"
import type { RelatedCreateTargetEndpoint } from "@/lib/relatedResourceCreate"
import type { ResourceDraft } from "./-resourceDraftStore"

function stripProviderPrefix(type: string, provider: string): string {
	const prefix = `${provider}_`
	return type.startsWith(prefix) ? type.slice(prefix.length) : type
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48)
}

function uniqueSlug(base: string): string {
	const suffix = Date.now().toString(36).slice(-5)
	return `${slugify(base) || "resource"}-${suffix}`
}

// The create_resource item shape for a type-search hit. Pure so the
// conditional spreads (trimmed displayName, optional position) and the
// integrationSlug/inputs contract are unit-testable without rendering — this
// is where a regressed onStage signature would silently mis-shape the body.
export function buildTypedResourceItem(input: {
	slug: string
	type: string
	integrationSlug: string
	metadataName?: string | null
	position?: { x: number; y: number } | null
}): StageChangeSetItemBody {
	const displayName = input.metadataName?.trim()
	return {
		kind: "create_resource",
		changes: {
			slug: input.slug,
			...(displayName ? { displayName } : {}),
			type: input.type,
			integrationSlug: input.integrationSlug,
			inputs: {},
			...(input.position ? { position: input.position } : {}),
		},
	}
}

function stagedItemIdBySlug(changeSet: ChangeSet, slug: string): string | null {
	const item = [...changeSet.items]
		.reverse()
		.find(
			(candidate) =>
				candidate.kind === "create_resource" &&
				candidate.changes &&
				typeof candidate.changes === "object" &&
				"slug" in candidate.changes &&
				candidate.changes.slug === slug,
		)
	return item?.id ?? null
}

export function ResourceCreateDialog({
	projectSlug,
	integrations,
	open,
	onOpenChange,
	onStagedItem,
	onDraftReady,
	initialPosition,
	relatedTarget,
}: {
	projectSlug: string
	integrations: Integration[]
	open: boolean
	onOpenChange: (open: boolean) => void
	// Used by the "empty resource" path and the related-create flow, which
	// still stage directly. The typed-create path defers to `onDraftReady`
	// instead so nothing hits the server until the user saves.
	onStagedItem: (stagedItemId: string) => void
	onDraftReady?: (draft: ResourceDraft) => void
	initialPosition?: { x: number; y: number } | null
	relatedTarget?: RelatedCreateTargetEndpoint | null
}) {
	const relatedTargetProvider = relatedTarget
		? inferProviderFromType(relatedTarget.type)
		: ""
	const selectableIntegrations = relatedTarget
		? integrations.filter(
				(integration) => integration.provider === relatedTargetProvider,
			)
		: integrations

	const stageMutation = useMutation({
		...stageChangeSetItemMutationOptions({ projectSlug, queryClient }),
		onSuccess: (changeSet, variables) => {
			const slug =
				variables.changes &&
				typeof variables.changes === "object" &&
				"slug" in variables.changes &&
				typeof variables.changes.slug === "string"
					? variables.changes.slug
					: null
			const itemId = slug ? stagedItemIdBySlug(changeSet, slug) : null
			if (itemId) onStagedItem(itemId)
			onOpenChange(false)
		},
		onError: (e) => {
			renderTaggedError(toast, e)
		},
	})

	function stage(body: StageChangeSetItemBody) {
		stageMutation.mutate(body)
	}

	function stageEmptyResource() {
		stage({
			kind: "create_resource",
			changes: {
				slug: uniqueSlug("empty-resource"),
				displayName: "Empty resource",
				...(initialPosition ? { position: initialPosition } : {}),
			},
		})
	}

	function stageTypedResource(
		integration: Integration,
		hit: SearchHit,
		metadataName?: string | null,
	) {
		stage(
			buildTypedResourceItem({
				slug: uniqueSlug(stripProviderPrefix(hit.type, hit.provider)),
				type: hit.type,
				integrationSlug: integration.slug,
				metadataName,
				position: initialPosition,
			}),
		)
	}

	function emitDraftFromHit(
		integration: Integration,
		hit: SearchHit,
		metadataName?: string | null,
	) {
		if (!onDraftReady) return
		onDraftReady({
			slug: uniqueSlug(stripProviderPrefix(hit.type, hit.provider)),
			type: hit.type,
			integrationSlug: integration.slug,
			displayName: metadataName?.trim() || null,
			position: initialPosition ?? null,
		})
		onOpenChange(false)
	}

	function stageRelatedTarget(integration: Integration) {
		if (!relatedTarget) return
		stageTypedResource(integration, {
			provider: integration.provider,
			type: relatedTarget.type,
			kinds: ["resource"],
			artifacts: { icon: null, metadata: null },
		})
	}

	return (
		<ResourcePickerWizard
			open={open}
			onOpenChange={onOpenChange}
			title={relatedTarget ? `Create ${relatedTarget.type}` : "Add resource"}
			description={
				relatedTarget
					? "Choose the integration for the related target."
					: undefined
			}
			integrations={selectableIntegrations}
			pending={stageMutation.isPending}
			pendingLabel="Staging..."
			actionLabel="Create"
			emptyIntegrationsMessage={
				relatedTarget
					? `No ${relatedTargetProvider || relatedTarget.type} integration is available.`
					: "No integrations available."
			}
			emptyOption={
				relatedTarget
					? undefined
					: {
							title: "Empty resource",
							subtitle: "Stage a providerless canvas node.",
							onSelect: stageEmptyResource,
						}
			}
			onProviderAction={relatedTarget ? stageRelatedTarget : undefined}
			onPickType={(integration, hit, metadataName) => {
				if (relatedTarget || !onDraftReady) {
					stageTypedResource(integration, hit, metadataName)
					return
				}
				emitDraftFromHit(integration, hit, metadataName)
			}}
		/>
	)
}
