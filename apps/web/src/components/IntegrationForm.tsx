import type { IntegrationView } from "@opsy/contracts"
import type {
	ProviderCredentialFormDefinition,
	ProviderIntegrationOnboardingMetadata,
} from "@opsy/provider"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef } from "react"
import { IntegrationOnboarding } from "@/components/integrations/IntegrationOnboarding"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	integrationSchemaQueryOptions,
	providersQueryOptions,
} from "@/lib/integrationReactQuery"
import {
	DiscriminatedUnion,
	defaultsFromSchema,
	type JsonSchemaProp,
	ObjectFields,
} from "./integrations/JsonSchemaForm"

export { defaultsFromSchema } from "./integrations/JsonSchemaForm"

export type IntegrationFormValue = {
	provider: string
	providerSource: string
	providerVersion: string
	name: string
	slug: string
	default: boolean
	credentials: Record<string, unknown>
	config: Record<string, unknown>
	// Edit-mode toggle: when false, the credentials section is read-only and
	// the existing row's credentials are preserved unchanged. When true, the
	// form's `credentials` payload is sent as an authoritative replacement.
	// Create always operates with this true (always authoritative).
	replaceCredentials: boolean
}

export type IntegrationFormSection =
	| "provider"
	| "identity"
	| "credentials"
	| "config"

interface Props {
	value: IntegrationFormValue
	onChange: (next: IntegrationFormValue) => void
	/** Present = edit mode. Disables provider/slug, hides the inline test
	 *  button (the sheet header has a contextual one), and gates the credential
	 *  section behind the "Replace credentials" toggle. */
	existing?: Pick<
		IntegrationView,
		"credentialsMode" | "isDefault" | "onboardingExternalId"
	>
	sections?: readonly IntegrationFormSection[]
}

// Pure projection of "what the form value should look like once schema-derived
// defaults are merged in": discriminator → preferredMode, generated fields
// (e.g. external_id UUID under AWS assume_role mode) minted for the active
// mode, config defaults filled where keys are blank. Returns the same `value`
// reference when nothing needs to change, so a useMemo over this stays stable
// and the upstream sync below is a no-op once the parent has caught up.
function seedFormDefaults(input: {
	value: IntegrationFormValue
	credentialDiscriminator: string | null
	credentialForm: ProviderCredentialFormDefinition | null
	configSchema: JsonSchemaProp | null
	mintGenerated: (kind: "uuid") => string
}): IntegrationFormValue {
	let credentials = input.value.credentials
	if (input.credentialDiscriminator && input.credentialForm?.preferredMode) {
		const current = credentials[input.credentialDiscriminator]
		if (typeof current !== "string") {
			credentials = {
				...credentials,
				[input.credentialDiscriminator]: input.credentialForm.preferredMode,
			}
		}
	}
	const activeMode =
		input.credentialDiscriminator &&
		typeof credentials[input.credentialDiscriminator] === "string"
			? (credentials[input.credentialDiscriminator] as string)
			: null
	const generatedForMode =
		activeMode && input.credentialForm?.createGeneratedFieldsByMode?.[activeMode]
	if (generatedForMode) {
		for (const [field, spec] of Object.entries(generatedForMode)) {
			if (typeof credentials[field] !== "string" || credentials[field] === "") {
				credentials = { ...credentials, [field]: input.mintGenerated(spec.kind) }
			}
		}
	}
	let config = input.value.config
	const configDefaults = defaultsFromSchema(input.configSchema)
	for (const [key, defaultValue] of Object.entries(configDefaults)) {
		if (config[key] === undefined) {
			config = config === input.value.config ? { ...config } : config
			config[key] = defaultValue
		}
	}
	return credentials === input.value.credentials &&
		config === input.value.config
		? input.value
		: { ...input.value, credentials, config }
}

export function IntegrationForm({
	value,
	onChange,
	existing,
	sections,
}: Props) {
	const isEdit = !!existing
	const visibleSections = new Set(
		sections ?? ["provider", "identity", "credentials", "config"],
	)
	const providersQuery = useQuery({
		...providersQueryOptions(),
		enabled: !isEdit,
	})
	const schemaQuery = useQuery(
		integrationSchemaQueryOptions({
			provider: value.provider,
			providerSource: value.providerSource,
			providerVersion: value.providerVersion,
		}),
	)

	const providerList = providersQuery.data?.providers ?? []
	const selectedProvider = providerList.find((p) => p.name === value.provider)
	const allowedVersions = selectedProvider?.versions ?? []
	const credSchema = schemaQuery.data?.credentials as JsonSchemaProp | null
	const configSchema = schemaQuery.data?.config as JsonSchemaProp | null
	const credIsUnion = !!(credSchema?.oneOf ?? credSchema?.anyOf)
	const credentialDiscriminator =
		typeof schemaQuery.data?.credentialDiscriminator === "string"
			? schemaQuery.data.credentialDiscriminator
			: null
	const credentialForm =
		(schemaQuery.data
			?.credentialForm as ProviderCredentialFormDefinition | null) ?? null
	const onboarding =
		(schemaQuery.data
			?.onboarding as ProviderIntegrationOnboardingMetadata | null) ?? null
	// Onboarding fires when the active mode (e.g. AWS source=assume_role)
	// declares a generated externalIdField. Create / edit-with-rotation: read
	// from the form value's top-level credentials. Edit without rotation: the
	// form's credentials are empty, so fall back to `existing.onboardingExternalId`
	// projected from the stored row.
	const onboardingExternalId = onboarding
		? value.replaceCredentials
			? (value.credentials[onboarding.externalIdField] as string | undefined) ??
				""
			: existing?.onboardingExternalId ?? ""
		: ""

	// Stable generated id cached per mount so a mode flip out-and-back returns
	// the same value (avoids surprising the user with a re-minted id after
	// they pasted the prior one into AWS).
	const generatedRef = useRef<Map<string, string>>(new Map())
	const seededValue = useMemo(() => {
		if (isEdit && !value.replaceCredentials) return value
		return seedFormDefaults({
			value,
			credentialDiscriminator,
			credentialForm,
			configSchema,
			mintGenerated: (kind) => {
				const cached = generatedRef.current.get(kind)
				if (cached) return cached
				const minted = kind === "uuid" ? crypto.randomUUID() : ""
				generatedRef.current.set(kind, minted)
				return minted
			},
		})
	}, [
		isEdit,
		value,
		credentialDiscriminator,
		credentialForm,
		configSchema,
	])

	// Push the seeded value upstream so submit handlers see the defaults even
	// if the user clicks Create without touching a field. `seededValue === value`
	// once the parent has caught up, so this is a one-shot per schema arrival.
	useEffect(() => {
		if (seededValue !== value) onChange(seededValue)
	}, [seededValue, value, onChange])

	return (
		<div className="grid gap-6">
			{visibleSections.has("provider") && (
				<div className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="provider">Provider</Label>
						{isEdit ? (
							<Input id="provider" value={value.provider} disabled readOnly />
						) : (
							<Select
								value={value.provider}
								onValueChange={(v) => {
									const nextProvider = providerList.find((p) => p.name === v)
									onChange({
										...value,
										provider: v,
										providerSource: nextProvider?.source ?? "",
										providerVersion:
											nextProvider?.versions?.[0] ??
											nextProvider?.version ??
											"",
										credentials: {},
										config: {},
									})
								}}
							>
								<SelectTrigger id="provider" className="w-full">
									<SelectValue placeholder="Select a provider" />
								</SelectTrigger>
								<SelectContent>
									{providerList.map((p) => (
										<SelectItem key={p.name} value={p.name}>
											{p.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>

					<div className="grid gap-2">
						<Label htmlFor="provider-version">Version</Label>
						{isEdit ? (
							<Input
								id="provider-version"
								value={value.providerVersion}
								disabled
								readOnly
							/>
						) : (
							<Select
								value={value.providerVersion}
								onValueChange={(v) =>
									onChange({ ...value, providerVersion: v })
								}
								disabled={!value.provider || allowedVersions.length === 0}
							>
								<SelectTrigger id="provider-version" className="w-full">
									<SelectValue placeholder="Select a version" />
								</SelectTrigger>
								<SelectContent>
									{allowedVersions.map((version) => (
										<SelectItem key={version} value={version}>
											{version}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>
				</div>
			)}

			{visibleSections.has("identity") && (
				<div className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="integration-slug">Slug</Label>
						<Input
							id="integration-slug"
							placeholder="aws-prod"
							value={value.slug}
							disabled={isEdit}
							readOnly={isEdit}
							onChange={(e) => onChange({ ...value, slug: e.target.value })}
						/>
						<p className="px-3 text-xs text-muted-foreground/70">
							Project-unique identity for this integration (e.g. aws-prod,
							aws-west).
						</p>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="integration-name">Name</Label>
						<Input
							id="integration-name"
							placeholder={value.slug || "defaults to the slug"}
							value={value.name}
							onChange={(e) => onChange({ ...value, name: e.target.value })}
						/>
						<p className="px-3 text-xs text-muted-foreground/70">
							Optional cosmetic label. Defaults to the slug.
						</p>
					</div>

					<div className="flex items-start gap-2">
						<Checkbox
							id="integration-default"
							checked={value.default}
							disabled={isEdit && existing?.isDefault === true}
							onCheckedChange={(c) =>
								onChange({ ...value, default: c === true })
							}
							className="mt-0.5"
						/>
						<div className="grid gap-1">
							<Label htmlFor="integration-default">
								Default for {value.provider || "this provider"}
							</Label>
							<p className="text-xs text-muted-foreground/70">
								{isEdit && existing?.isDefault
									? "This is the default — switch by promoting another integration."
									: isEdit
										? "Promote this over the current default for its provider."
										: "The first integration for a provider is the default automatically."}
							</p>
						</div>
					</div>
				</div>
			)}

			{value.provider && schemaQuery.isLoading && (
				<p className="text-xs text-muted-foreground/70">Loading schema…</p>
			)}

			{visibleSections.has("credentials") && credSchema && (
				<section className="grid gap-3">
					<h3 className="text-sm font-medium">Credentials</h3>
					{isEdit && (
						<div className="flex items-start gap-2">
							<Checkbox
								id="integration-replace-credentials"
								checked={value.replaceCredentials}
								onCheckedChange={(c) =>
									onChange({
										...value,
										replaceCredentials: c === true,
										// Reset when toggling off so a half-typed payload doesn't
										// linger; the upstream submit ignores it anyway, but the
										// view-state should be clean.
										credentials: c === true ? value.credentials : {},
									})
								}
								className="mt-0.5"
							/>
							<div className="grid gap-1">
								<Label htmlFor="integration-replace-credentials">
									Replace credentials
								</Label>
								<p className="text-xs text-muted-foreground/70">
									{value.replaceCredentials
										? "Submitting will overwrite the stored credentials."
										: "Existing credentials are kept. Toggle on to rotate."}
								</p>
							</div>
						</div>
					)}
					{(!isEdit || value.replaceCredentials) &&
						(credIsUnion ? (
							<DiscriminatedUnion
								schema={credSchema}
								value={value.credentials}
								onChange={(next) => onChange({ ...value, credentials: next })}
								hideFields={credentialForm?.createHiddenFieldsByMode}
								preferredMode={credentialForm?.preferredMode}
							/>
						) : (
							<ObjectFields
								schema={credSchema}
								value={value.credentials}
								onChange={(next) => onChange({ ...value, credentials: next })}
							/>
						))}
				</section>
			)}

			{visibleSections.has("credentials") &&
				onboarding &&
				onboardingExternalId && (
					<IntegrationOnboarding
						onboarding={onboarding}
						provider={value.provider}
						providerSource={value.providerSource}
						providerVersion={value.providerVersion}
						externalId={onboardingExternalId}
					/>
				)}

			{visibleSections.has("config") && configSchema && (
				<section className="grid gap-3">
					<h3 className="text-sm font-medium">Config</h3>
					<ObjectFields
						schema={configSchema}
						value={value.config}
						onChange={(next) => onChange({ ...value, config: next })}
					/>
				</section>
			)}
		</div>
	)
}
