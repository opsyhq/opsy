import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useMemo, useRef } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ResourceTypeIconForType } from "@/components/ResourceTypeIcon"
import { resolveTypeView } from "@/components/resource-detail/resolvedTypeView"
import {
	fieldLayoutRowsToResolvedFields,
	resolveFieldLayout,
} from "@/components/resource-fields/fieldLayout"
import { ResourceFieldsForm } from "@/components/resource-fields/ResourceFieldsForm"
import { pruneBlanks } from "@/components/resource-fields/resolverSchema"
import { Button } from "@/components/ui/button"
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { renderTaggedError } from "@/errors/error-toast"
import {
	type ChangeSet,
	type ChangeSetItem,
	changesRecord,
	stageChangeSetItemMutationOptions,
	updateChangeSetItemMutationOptions,
} from "@/lib/changeSetReactQuery"
import { getProviderMeta } from "@/lib/providerMeta"
import {
	typeArtifactsQueryOptions,
	typeSchemaQueryOptions,
} from "@/lib/providerReactQuery"
import { queryClient } from "@/lib/query"
import type {
	RelatedCreateFieldRequest,
	RelatedCreateSource,
} from "@/lib/relatedResourceCreate"
import { cn } from "@/lib/utils"
import {
	type Integration,
	inferProviderFromType,
	type ProviderResourceForm,
	providerResourceFormSchema,
	slugifyName,
} from "./shared"

// Editor mode discriminates "edit an existing staged item" (update mutation)
// from "configure a brand-new resource" (stage mutation). The two share the
// same form chrome and field layout — only how Save submits differs.
export type ProviderResourceEditorMode =
	| { kind: "edit"; stagedItem: ChangeSetItem }
	| {
			kind: "draft"
			draft: {
				slug: string
				type: string
				integrationSlug: string
				displayName: string | null
				position: { x: number; y: number } | null
			}
	  }

export function ProviderResourceTitle({
	stagedItem,
}: {
	stagedItem: ChangeSetItem
}) {
	const initialChanges = changesRecord(stagedItem)
	const initialType =
		typeof initialChanges?.type === "string" ? initialChanges.type : null
	const initialProvider = initialType ? inferProviderFromType(initialType) : ""
	const artifactsQuery = useQuery(
		typeArtifactsQueryOptions({
			provider: initialProvider,
			type: initialType ?? "",
			kind: "resource",
			enabled: !!initialProvider && !!initialType,
		}),
	)
	if (!initialProvider || !initialType) return <span>Resource</span>
	const providerMeta = getProviderMeta(initialProvider)
	const name = artifactsQuery.data?.metadata.data?.name?.trim()
	const generating =
		artifactsQuery.isLoading ||
		artifactsQuery.data?.metadata.status === "pending" ||
		artifactsQuery.data?.metadata.status === "running"
	const label = generating ? initialType : (name ?? initialType)
	return (
		<span className="flex min-w-0 items-center gap-2">
			<ResourceTypeIconForType
				provider={providerMeta}
				type={initialType}
				icon={artifactsQuery.data?.icon}
				size="sm"
			/>
			<span className={cn("truncate", (!name || generating) && "font-mono")}>
				{label}
			</span>
			{generating && (
				<Loader2
					className="size-3.5 shrink-0 animate-spin text-muted-foreground"
					aria-label="Loading type metadata"
				/>
			)}
		</span>
	)
}

export function ProviderResourceEditor({
	projectSlug,
	integrations,
	onClose,
	onSaved,
	onCreateReferenceTarget,
	changeSetId,
	mode,
}: {
	projectSlug: string
	integrations: Integration[]
	onClose: () => void
	onSaved?: (changeSet: ChangeSet, stagedItemId: string) => void
	onCreateReferenceTarget?: (request: {
		source: RelatedCreateSource
		targetEndpoint: RelatedCreateFieldRequest["targetEndpoint"]
	}) => void
	changeSetId?: string | null
	mode: ProviderResourceEditorMode
}) {
	const stagedItem = mode.kind === "edit" ? mode.stagedItem : null
	const draft = mode.kind === "draft" ? mode.draft : null
	const initialChanges = stagedItem ? changesRecord(stagedItem) : null
	const initialType =
		mode.kind === "draft"
			? mode.draft.type
			: typeof initialChanges?.type === "string"
				? initialChanges.type
				: null
	const initialProvider = initialType ? inferProviderFromType(initialType) : ""

	// The integration is implied: keep whatever the staged item already carries,
	// otherwise resolve it from the integration that matches the type's provider.
	const initialIntegrationSlug =
		(mode.kind === "draft"
			? mode.draft.integrationSlug
			: typeof initialChanges?.integrationSlug === "string" &&
				initialChanges.integrationSlug) ||
		integrations.find((i) => i.provider === initialProvider)?.slug ||
		""

	const form = useForm<ProviderResourceForm>({
		resolver: zodResolver(providerResourceFormSchema),
		defaultValues: {
			slug:
				mode.kind === "draft"
					? mode.draft.slug
					: typeof initialChanges?.slug === "string"
						? initialChanges.slug
						: "",
			displayName:
				mode.kind === "draft"
					? (mode.draft.displayName ?? "")
					: typeof initialChanges?.displayName === "string"
						? initialChanges.displayName
						: "",
			integrationSlug: initialIntegrationSlug,
			values:
				mode.kind === "draft"
					? {}
					: initialChanges?.inputs && typeof initialChanges.inputs === "object"
						? (initialChanges.inputs as Record<string, unknown>)
						: {},
		},
		mode: "onChange",
	})

	const slugTouchedRef = useRef(false)

	const updateMutation = useMutation({
		...updateChangeSetItemMutationOptions({
			projectSlug,
			id: changeSetId ?? "",
			queryClient,
		}),
		onSuccess: (changeSet) => {
			toast.success(onSaved ? "Resource staged" : "Resource updated")
			if (onSaved && stagedItem) onSaved(changeSet, stagedItem.id)
			else onClose()
		},
		onError: (e) => renderTaggedError(toast, e),
	})

	const stageMutation = useMutation({
		...stageChangeSetItemMutationOptions({ projectSlug, queryClient }),
		onSuccess: (changeSet, variables) => {
			toast.success("Resource staged")
			// Resolve the just-created item id by slug so the parent can move the
			// sheet from draft → detail without re-querying.
			const submittedSlug =
				variables.changes &&
				typeof variables.changes === "object" &&
				"slug" in variables.changes &&
				typeof variables.changes.slug === "string"
					? variables.changes.slug
					: null
			const created = submittedSlug
				? [...changeSet.items].reverse().find(
						(candidate) =>
							candidate.kind === "create_resource" &&
							candidate.changes &&
							typeof candidate.changes === "object" &&
							"slug" in candidate.changes &&
							(candidate.changes as Record<string, unknown>).slug ===
								submittedSlug,
					)
				: null
			if (created && onSaved) onSaved(changeSet, created.id)
			else onClose()
		},
		onError: (e) => renderTaggedError(toast, e),
	})

	const changesFromFormData = (data: ProviderResourceForm) => {
		if (!initialType || !initialProvider || !changeSetId) return
		const trimmedDisplayName = data.displayName?.trim()
		const includeInputs = stagedItem
			? stagedItem.kind !== "import_resource"
			: true
		const base = {
			slug: data.slug,
			type: initialType,
			displayName: trimmedDisplayName || undefined,
			integrationSlug: data.integrationSlug || undefined,
		}
		const withPosition =
			draft?.position != null ? { ...base, position: draft.position } : base
		return includeInputs
			? { ...withPosition, inputs: pruneBlanks(data.values) }
			: withPosition
	}

	const onSubmit = form.handleSubmit((data) => {
		const changes = changesFromFormData(data)
		if (!changes) return
		if (mode.kind === "draft") {
			stageMutation.mutate({ kind: "create_resource", changes })
			return
		}
		if (stagedItem?.kind === "import_resource") {
			updateMutation.mutate({
				itemId: stagedItem.id,
				body: { kind: "import_resource", changes },
			})
			return
		}
		if (stagedItem?.kind === "create_resource") {
			updateMutation.mutate({
				itemId: stagedItem.id,
				body: { kind: "create_resource", changes },
			})
		}
	})

	const values = form.watch("values")

	const typeReady = !!initialProvider && !!initialType
	const schemaQuery = useQuery(
		typeSchemaQueryOptions({
			provider: initialProvider,
			type: initialType ?? "",
			kind: "resource",
			enabled: typeReady,
		}),
	)
	const artifactsQuery = useQuery(
		typeArtifactsQueryOptions({
			provider: initialProvider,
			type: initialType ?? "",
			kind: "resource",
			enabled: typeReady,
		}),
	)
	const view = useMemo(
		() =>
			resolveTypeView({
				schema: schemaQuery.data?.resource,
				artifacts: artifactsQuery.data ?? null,
			}),
		[schemaQuery.data, artifactsQuery.data],
	)
	const createLayout = useMemo(
		() =>
			view
				? resolveFieldLayout(view, view.artifacts?.fieldLayout.data ?? null)
				: null,
		[view],
	)
	const createFormView = useMemo(
		() =>
			view && createLayout
				? {
						...view,
						fields: fieldLayoutRowsToResolvedFields(createLayout.create.rows),
					}
				: null,
		[view, createLayout],
	)
	const submitPending = updateMutation.isPending || stageMutation.isPending
	const canSave = !!changeSetId && form.formState.isValid && !submitPending
	// Reference-target wiring needs a real staged source item id to write back
	// into, so it's only available once the resource has been saved. In draft
	// mode the user must Save first, then start the related-create from the
	// now-staged item.
	const createReferenceTarget =
		onCreateReferenceTarget && stagedItem
			? (request: RelatedCreateFieldRequest) => {
					const data = form.getValues()
					const changes = changesFromFormData({
						...data,
						values: request.values,
					})
					if (!changes) return
					onCreateReferenceTarget({
						targetEndpoint: request.targetEndpoint,
						source: {
							kind: "staged",
							stagedItemId: stagedItem.id,
							fieldPath: request.fieldPath,
							cardinality: request.cardinality,
							changes,
							returnMode: "create",
						},
					})
				}
			: undefined

	if (!initialProvider || !initialType) {
		return (
			<div className="flex h-full flex-col">
				<div className="px-4 pt-1 pb-4">
					<p className="text-xs text-muted-foreground/70">
						This resource is missing provider type metadata.
					</p>
				</div>

				<footer className="mt-auto flex flex-row items-center justify-end gap-2 border-t px-4 py-3">
					<Button type="button" variant="ghost" size="sm" onClick={onClose}>
						Close
					</Button>
				</footer>
			</div>
		)
	}

	return (
		<Form {...form}>
			<form onSubmit={onSubmit} className="flex h-full flex-col">
				<div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-1 pb-4">
					<FormField
						control={form.control}
						name="displayName"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Name</FormLabel>
								<FormControl>
									<Input
										placeholder="My production bucket"
										{...field}
										onChange={(e) => {
											const next = e.target.value
											field.onChange(next)
											if (!slugTouchedRef.current) {
												form.setValue("slug", slugifyName(next), {
													shouldValidate: true,
												})
											}
										}}
									/>
								</FormControl>
								<FormDescription className="text-xs text-muted-foreground/70">
									Optional friendly label for listings. The slug below is
									derived automatically; edit it directly if you want.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="slug"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Slug</FormLabel>
								<FormControl>
									<Input
										placeholder="my-bucket"
										{...field}
										onChange={(e) => {
											slugTouchedRef.current = true
											field.onChange(e.target.value)
										}}
									/>
								</FormControl>
								<FormDescription className="text-xs text-muted-foreground/70">
									Lowercase letters, digits, and hyphens. Must be unique within
									the project.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="grid gap-2">
						{schemaQuery.isLoading ? (
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<Loader2 className="size-3.5 animate-spin" />
								Loading schema…
							</div>
						) : view ? (
							<ResourceFieldsForm
								view={createFormView ?? view}
								value={values}
								projectSlug={projectSlug}
								layoutRows={createLayout?.create.rows}
								onChange={(next) => form.setValue("values", next)}
								onCreateReferenceTarget={createReferenceTarget}
							/>
						) : (
							<p className="text-xs text-muted-foreground/70">
								No schema available for this type.
							</p>
						)}
					</div>
				</div>

				<footer className="mt-auto flex flex-row items-center justify-between gap-2 border-t px-4 py-2.5">
					<Button
						type="button"
						variant="outline"
						size="xs"
						className="h-7 px-3"
						onClick={onClose}
					>
						Cancel
					</Button>
					<div className="flex items-center justify-end gap-2">
						<Button
							type="submit"
							size="xs"
							className="h-7 px-3"
							disabled={!canSave}
						>
							{submitPending ? "Saving..." : "Save"}
						</Button>
					</div>
				</footer>
			</form>
		</Form>
	)
}
