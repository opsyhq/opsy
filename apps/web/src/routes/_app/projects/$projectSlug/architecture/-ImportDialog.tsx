import type { SearchHit } from "@opsy/api"
import { useMutation, useQuery } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
	type Integration,
	ResourcePickerWizard,
} from "@/components/ResourcePickerWizard"
import { ResourceTypeIconForType } from "@/components/ResourceTypeIcon"
import { FieldHelpWrap } from "@/components/resource-fields/ResourceFieldChrome"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getProviderMeta } from "@/lib/providerMeta"
import {
	typeArtifactsQueryOptions,
	typeIdentityQueryOptions,
} from "@/lib/providerReactQuery"
import { queryClient } from "@/lib/query"
import { importResourceMutationOptions } from "@/lib/resourceReactQuery"
import { cn } from "@/lib/utils"

function slugify(seed: string): string {
	return (
		seed
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 64) || "imported"
	)
}

export function ImportDialog({
	projectSlug,
	integrations,
	open,
	onOpenChange,
	initialIntegrationSlug,
	initialPosition,
	onImported,
}: {
	projectSlug: string
	integrations: Integration[]
	open: boolean
	onOpenChange: (open: boolean) => void
	initialIntegrationSlug?: string
	initialPosition?: { x: number; y: number } | null
	onImported?: (slug: string) => void
}) {
	return (
		<ResourcePickerWizard
			open={open}
			onOpenChange={onOpenChange}
			title="Import resource"
			description="Bring an existing cloud resource under management."
			integrations={integrations}
			pending={false}
			pendingLabel="Importing..."
			actionLabel="Import"
			emptyIntegrationsMessage="No integrations available."
			initialIntegrationSlug={initialIntegrationSlug}
			renderTerminal={({ integration, hit, onBack }) => (
				<ImportIdentityForm
					key={hit.type}
					projectSlug={projectSlug}
					integration={integration}
					hit={hit}
					onBack={onBack}
					onDone={() => onOpenChange(false)}
					initialPosition={initialPosition ?? null}
					onImported={onImported}
				/>
			)}
		/>
	)
}

// Terminal step of the import wizard: the bridge owns whether a type has a
// structured import identity, so `mode` drives the form — per-attribute
// inputs vs. a single raw import ID. An identity-resolution error means the
// type can't be brought under management here.
function ImportIdentityForm({
	projectSlug,
	integration,
	hit,
	onBack,
	onDone,
	initialPosition,
	onImported,
}: {
	projectSlug: string
	integration: Integration
	hit: SearchHit
	onBack: () => void
	onDone: () => void
	initialPosition: { x: number; y: number } | null
	onImported?: (slug: string) => void
}) {
	const type = hit.type
	const [providerId, setProviderId] = useState("")
	const [identityValues, setIdentityValues] = useState<Record<string, string>>(
		{},
	)
	const [importSlug, setImportSlug] = useState("")
	const [slugEdited, setSlugEdited] = useState(false)
	const [showOptional, setShowOptional] = useState(false)

	const identityQuery = useQuery(
		typeIdentityQueryOptions({ provider: integration.provider, type }),
	)
	const identity = identityQuery.data
	const isIdentityMode = identity?.mode === "identity"
	const isImportIdMode = identity?.mode === "import-id"
	// Field-metadata labels for identity inputs come from the type's
	// fieldMetadata artifact, looked up by attribute name (which equals the
	// schema input path for top-level identity attributes). Raw attr.name and
	// attr.description are the fallback while the artifact is generating.
	const typeArtifactsQuery = useQuery({
		...typeArtifactsQueryOptions({
			provider: integration.provider,
			type,
			kind: "resource",
		}),
		enabled: isIdentityMode,
	})
	const fieldMetadataByPath = typeArtifactsQuery.data?.fieldMetadata.data
	const typeMetadataName =
		typeArtifactsQuery.data?.metadata.data?.name?.trim() ||
		hit.artifacts.metadata?.data?.name?.trim() ||
		null
	const typeHeaderTitle = typeMetadataName ?? type
	const identityAttrs =
		identity?.mode === "identity" ? identity.identity.attributes : []
	// Required attributes uniquely identify the resource and are all most
	// imports need. Optional ones are overrides (e.g. account/region defaulted
	// from the integration) — hide them behind a disclosure unless there are
	// no required attributes to show on their own.
	const requiredAttrs = identityAttrs.filter((attr) => attr.required_for_import)
	const optionalAttrs = identityAttrs.filter(
		(attr) => !attr.required_for_import,
	)
	const optionalVisible = showOptional || requiredAttrs.length === 0
	// Seed the slug from the most identifying value: the primary required
	// identity attribute, else the first attribute, else the raw import ID.
	const primaryAttr =
		identityAttrs.find((attr) => attr.required_for_import) ?? identityAttrs[0]
	const slugSeed = isIdentityMode
		? primaryAttr
			? (identityValues[primaryAttr.name] ?? "")
			: ""
		: providerId

	useEffect(() => {
		if (slugEdited || !slugSeed) return
		setImportSlug(slugify(slugSeed))
	}, [slugSeed, slugEdited])

	const importResource = useMutation({
		...importResourceMutationOptions({ projectSlug, queryClient }),
		onSuccess: () => {
			toast.success("Import started")
			onImported?.(importSlug)
			onDone()
		},
	})

	const requiredAttrsFilled = requiredAttrs.every((attr) =>
		Boolean((identityValues[attr.name] ?? "").trim()),
	)
	const handleProvided = isIdentityMode
		? identityAttrs.length > 0 && requiredAttrsFilled
		: isImportIdMode
			? Boolean(providerId.trim())
			: false
	const canSubmit =
		Boolean(importSlug) &&
		!identityQuery.isLoading &&
		!identityQuery.isError &&
		handleProvided

	function onSubmitImport(event: React.FormEvent) {
		event.preventDefault()
		if (!canSubmit) return
		const base = {
			slug: importSlug,
			type,
			integrationSlug: integration.slug,
			...(initialPosition ? { position: initialPosition } : {}),
		}
		if (isIdentityMode) {
			const collected: Record<string, string> = {}
			for (const attr of identityAttrs) {
				const value = (identityValues[attr.name] ?? "").trim()
				if (value) collected[attr.name] = value
			}
			importResource.mutate({ ...base, identity: collected })
			return
		}
		importResource.mutate({ ...base, providerId: providerId.trim() })
	}

	const renderAttr = (attr: (typeof identityAttrs)[number]) => {
		const meta = fieldMetadataByPath?.[attr.name]
		const label = meta?.label ?? attr.name
		const help = meta?.help ?? attr.description
		return (
			<div key={attr.name} className="flex flex-col gap-1">
				<FieldHelpWrap label={label} help={help}>
					<Label className="text-xs">{label}</Label>
				</FieldHelpWrap>
				<Input
					className="h-8 font-mono"
					value={identityValues[attr.name] ?? ""}
					onChange={(event) =>
						setIdentityValues((prev) => ({
							...prev,
							[attr.name]: event.target.value,
						}))
					}
					required={attr.required_for_import ?? false}
				/>
			</div>
		)
	}

	const provider = getProviderMeta(integration.provider)

	return (
		<form
			onSubmit={onSubmitImport}
			className="flex min-h-0 flex-1 flex-col gap-4"
		>
			<div className="flex w-full min-w-0 items-center gap-3 rounded-lg border bg-background px-3 py-2">
				<ResourceTypeIconForType
					provider={provider}
					type={hit.type}
					icon={hit.artifacts.icon}
					size="md"
				/>
				<div className="min-w-0 flex-1">
					<div
						className={cn(
							"min-w-0 flex-1 truncate text-xs font-medium",
							!typeMetadataName && "font-mono",
						)}
					>
						{typeHeaderTitle}
					</div>
					<div className="truncate font-mono text-[11px] text-muted-foreground">
						{type} · {integration.slug} ({integration.provider})
					</div>
				</div>
				<Button
					type="button"
					variant="outline"
					size="xs"
					className="h-7 px-3"
					onClick={onBack}
				>
					Change
				</Button>
			</div>

			{identityQuery.isLoading && (
				<p className="text-xs text-muted-foreground">Resolving “{type}”…</p>
			)}
			{identityQuery.isError && (
				<div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
					This type can’t be imported — no resource identity is available for{" "}
					<code className="font-mono">{type}</code>. Pick a different type.
				</div>
			)}

			{!identityQuery.isError && (
				<div className="flex flex-col gap-1">
					<Label className="text-xs">Slug</Label>
					<Input
						className="h-8"
						value={importSlug}
						onChange={(event) => {
							setSlugEdited(true)
							setImportSlug(event.target.value)
						}}
						required
					/>
				</div>
			)}

			{isImportIdMode && (
				<div className="flex flex-col gap-1">
					<Label className="text-xs">Provider import ID</Label>
					<Input
						className="h-8 font-mono"
						value={providerId}
						onChange={(event) => setProviderId(event.target.value)}
						placeholder="e.g. i-1234567890abcdef0 or my-bucket-name"
						required
					/>
					<p className="text-xs text-muted-foreground">
						The identifier Terraform uses to import this resource — the value
						you would pass to{" "}
						<code className="font-mono">terraform import</code>.
					</p>
				</div>
			)}

			{isIdentityMode && (
				<>
					{requiredAttrs.map(renderAttr)}

					{optionalAttrs.length > 0 && (
						<div className="flex flex-col gap-3">
							{requiredAttrs.length > 0 && (
								<button
									type="button"
									onClick={() => setShowOptional((prev) => !prev)}
									className="flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
								>
									<ChevronRight
										className={cn(
											"size-3.5 transition-transform",
											optionalVisible && "rotate-90",
										)}
									/>
									Override {optionalAttrs.map((attr) => attr.name).join(" / ")}{" "}
									(optional)
								</button>
							)}
							{optionalVisible && optionalAttrs.map(renderAttr)}
						</div>
					)}
				</>
			)}

			<div className="mt-auto flex items-center justify-end gap-2 pt-2">
				<Button type="submit" disabled={importResource.isPending || !canSubmit}>
					{importResource.isPending ? "Importing..." : "Import"}
				</Button>
			</div>
		</form>
	)
}
