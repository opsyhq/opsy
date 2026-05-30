import type { IntegrationView } from "@opsy/contracts"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import {
	type FormEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useState,
} from "react"
import { toast } from "sonner"
import { FloatingPanel } from "@/components/FloatingPanel"
import {
	IntegrationForm,
	type IntegrationFormSection,
	type IntegrationFormValue,
} from "@/components/IntegrationForm"
import { ProviderLogo } from "@/components/ProviderLogo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { renderTaggedError } from "@/errors/error-toast"
import {
	checkDraftProjectIntegrationMutationOptions,
	checkProjectIntegrationMutationOptions,
	createProjectIntegrationMutationOptions,
	deleteProjectIntegrationMutationOptions,
	integrationBySlugQueryOptions,
	integrationSchemaQueryOptions,
	updateProjectIntegrationMutationOptions,
} from "@/lib/integrationReactQuery"
import { getProviderMeta } from "@/lib/providerMeta"
import { queryClient } from "@/lib/query"

const EMPTY_FORM: IntegrationFormValue = {
	provider: "",
	providerSource: "",
	providerVersion: "",
	name: "",
	slug: "",
	default: false,
	credentials: {},
	config: {},
	replaceCredentials: true,
}

const CREATE_SECTIONS: IntegrationFormSection[] = [
	"provider",
	"identity",
	"credentials",
	"config",
]

const EDIT_SECTIONS: IntegrationFormSection[] = [
	"identity",
	"credentials",
	"config",
]

const PANEL_WIDTH = 800
const PANEL_HEIGHT = 710

type ConnectionCheck = {
	status: "valid" | "invalid" | "unknown"
	checkedAt: string
	diagnostics: Array<{ severity: string; summary: string; detail?: string }>
}

function connectionCheckLabel(status: ConnectionCheck["status"]): string {
	if (status === "valid") return "Connection check passed"
	if (status === "invalid") return "Connection check failed"
	return "Connection status unknown"
}

function connectionCheckDot(status: ConnectionCheck["status"]): string {
	if (status === "valid") return "bg-emerald-400"
	if (status === "invalid") return "bg-destructive"
	return "bg-amber-400"
}

function ConnectionCheckSummary({ check }: { check: ConnectionCheck | null }) {
	if (!check) return null
	const first = check.diagnostics[0]
	return (
		<div className="mt-5 rounded-lg border bg-muted/20 p-4">
			<div className="flex items-center gap-2 text-sm">
				<span
					className={`size-2 rounded-full ${connectionCheckDot(check.status)}`}
				/>
				{connectionCheckLabel(check.status)}
			</div>
			{first && (
				<p className="mt-1 text-xs font-light text-muted-foreground">
					{first.summary}
					{first.detail ? ` — ${first.detail}` : ""}
				</p>
			)}
		</div>
	)
}

/** null = closed; "create" = create flow; { slug } = edit flow for that row. */
export type IntegrationSheetTarget = null | "create" | { slug: string }

export function IntegrationSheet({
	projectSlug,
	target,
	onOpenChange,
}: {
	projectSlug: string
	target: IntegrationSheetTarget
	onOpenChange: (open: boolean) => void
}) {
	const open = target !== null
	if (!open) return null

	return target === "create" ? (
		<CreateBody
			projectSlug={projectSlug}
			open={open}
			onClose={() => onOpenChange(false)}
		/>
	) : target ? (
		<EditBody
			projectSlug={projectSlug}
			slug={target.slug}
			open={open}
			onClose={() => onOpenChange(false)}
		/>
	) : null
}

function IntegrationSheetBody({
	open,
	onClose,
	title,
	headerRight,
	form,
	setForm,
	sections,
	existing,
	checkResult,
	innerContent,
	leftAction,
	test,
	submit,
	onSubmit,
}: {
	open: boolean
	onClose: () => void
	title: ReactNode
	headerRight?: ReactNode
	form: IntegrationFormValue
	setForm: (next: IntegrationFormValue) => void
	sections: IntegrationFormSection[]
	existing?: Pick<
		IntegrationView,
		"credentialsMode" | "isDefault" | "onboardingExternalId"
	>
	checkResult: ConnectionCheck | null
	innerContent?: ReactNode
	leftAction: ReactNode
	test: {
		onClick: () => void
		disabled: boolean
		pending: boolean
	}
	submit: {
		canSubmit: boolean
		pending: boolean
		idleLabel: string
		busyLabel: string
	}
	onSubmit: (e: FormEvent) => void
}) {
	return (
		<FloatingPanel
			open={open}
			onClose={onClose}
			title={title}
			headerRight={headerRight}
			closeButtonClassName="hover:bg-transparent dark:hover:bg-transparent"
			placement="center"
			defaultWidth={PANEL_WIDTH}
			defaultHeight={PANEL_HEIGHT}
			defaultHeightHint={PANEL_HEIGHT}
			minWidth={500}
			maxWidth={1200}
			bodyClassName="flex flex-col overflow-hidden px-0 pt-0"
		>
			<form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
					<IntegrationForm
						value={form}
						onChange={setForm}
						sections={sections}
						existing={existing}
					/>
					<ConnectionCheckSummary check={checkResult} />
					{innerContent}
				</div>

				<div className="flex items-center justify-between gap-2 border-t px-4 py-2.5">
					{leftAction}
					<div className="flex items-center justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							size="xs"
							className="h-7 px-3"
							onClick={test.onClick}
							disabled={test.disabled}
						>
							{test.pending && <Loader2 className="size-3 animate-spin" />}
							{test.pending ? "Checking..." : "Test connection"}
						</Button>
						<Button
							type="submit"
							size="xs"
							className="h-7 px-3"
							disabled={!submit.canSubmit || submit.pending}
						>
							{submit.pending && <Loader2 className="size-3 animate-spin" />}
							{submit.pending ? submit.busyLabel : submit.idleLabel}
						</Button>
					</div>
				</div>
			</form>
		</FloatingPanel>
	)
}

function CreateBody({
	projectSlug,
	open,
	onClose,
}: {
	projectSlug: string
	open: boolean
	onClose: () => void
}) {
	const [form, setForm] = useState<IntegrationFormValue>(EMPTY_FORM)
	const [checkResult, setCheckResult] = useState<ConnectionCheck | null>(null)

	const checkMutation = useMutation({
		...checkDraftProjectIntegrationMutationOptions({ projectSlug }),
		onSuccess: ({ check }) => {
			setCheckResult(check)
			if (check.status === "valid") {
				toast.success("Connection check passed")
				return
			}
			if (check.status === "invalid") {
				toast.error(check.diagnostics[0]?.summary ?? "Connection check failed")
				return
			}
			toast.info(check.diagnostics[0]?.summary ?? "Connection status unknown")
		},
		onError: (e) => renderTaggedError(toast, e),
	})

	const createMutation = useMutation({
		...createProjectIntegrationMutationOptions({ projectSlug, queryClient }),
		onSuccess: () => {
			toast.success("Integration created")
			onClose()
		},
		onError: (e) => renderTaggedError(toast, e),
	})

	// Submission depends on the provider schema having loaded so the form has
	// run `seedFormDefaults` (which fills the discriminator and any generated
	// fields). Without this, a user who clicks Create the instant after picking
	// a provider can submit credentials missing the discriminator and hit a
	// raw Zod error on the server. The query is shared by key with the form's
	// own call — no extra network round-trip.
	const schemaQuery = useQuery(
		integrationSchemaQueryOptions({
			provider: form.provider,
			providerSource: form.providerSource,
			providerVersion: form.providerVersion,
		}),
	)
	const schemaReady = !!form.provider && !schemaQuery.isLoading
	const canSave =
		!!form.provider && !!form.providerVersion && !!form.slug && schemaReady

	function onSubmit(e: FormEvent) {
		e.preventDefault()
		createMutation.mutate({
			provider: form.provider,
			...(form.providerSource ? { providerSource: form.providerSource } : {}),
			...(form.providerVersion
				? { providerVersion: form.providerVersion }
				: {}),
			slug: form.slug,
			...(form.name ? { name: form.name } : {}),
			...(form.default ? { default: true } : {}),
			credentials: form.credentials,
			config: form.config,
		})
	}

	return (
		<IntegrationSheetBody
			open={open}
			onClose={onClose}
			title={<span className="text-sm font-medium">Connect provider</span>}
			form={form}
			setForm={setForm}
			sections={CREATE_SECTIONS}
			checkResult={checkResult}
			leftAction={
				<Button
					type="button"
					variant="ghost"
					size="xs"
					className="h-7 px-3"
					onClick={onClose}
				>
					Cancel
				</Button>
			}
			test={{
				onClick: () =>
					checkMutation.mutate({
						provider: form.provider,
						...(form.providerSource
							? { providerSource: form.providerSource }
							: {}),
						...(form.providerVersion
							? { providerVersion: form.providerVersion }
							: {}),
						credentials: form.credentials,
						config: form.config,
					}),
				disabled:
					!form.provider || checkMutation.isPending || createMutation.isPending,
				pending: checkMutation.isPending,
			}}
			submit={{
				canSubmit: canSave,
				pending: createMutation.isPending,
				idleLabel: "Create",
				busyLabel: "Creating...",
			}}
			onSubmit={onSubmit}
		/>
	)
}

function EditBody({
	projectSlug,
	slug,
	open,
	onClose,
}: {
	projectSlug: string
	slug: string
	open: boolean
	onClose: () => void
}) {
	const [confirmDelete, setConfirmDelete] = useState(false)
	const [checkResult, setCheckResult] = useState<ConnectionCheck | null>(null)
	const { data, isLoading } = useQuery(
		integrationBySlugQueryOptions({ projectSlug, slug }),
	)
	const integration = data?.integration

	const [form, setForm] = useState<IntegrationFormValue>(EMPTY_FORM)

	// Seed the form from the loaded integration. Re-run only when the server row
	// identity or timestamp changes, so background refetches do not wipe edits.
	// biome-ignore lint/correctness/useExhaustiveDependencies: id+updatedAt are the cache key for "is this still the same server-side row"; deeper deps would stomp edits.
	useEffect(() => {
		if (!integration) return
		setForm({
			provider: integration.provider,
			providerSource: integration.providerSource ?? "",
			providerVersion: integration.providerVersion ?? "",
			name: integration.name ?? "",
			slug: integration.slug,
			default: integration.isDefault,
			credentials: {},
			config: (integration.config as Record<string, unknown>) ?? {},
			replaceCredentials: false,
		})
	}, [integration?.id, integration?.updatedAt])

	const updateMutation = useMutation({
		...updateProjectIntegrationMutationOptions({
			projectSlug,
			slug,
			queryClient,
		}),
		onSuccess: () => toast.success("Integration updated"),
		onError: (e) => renderTaggedError(toast, e),
	})

	const checkMutation = useMutation({
		...checkProjectIntegrationMutationOptions({ projectSlug, queryClient }),
		onSuccess: ({ check }) => {
			setCheckResult(check)
			if (check.status === "valid") {
				toast.success("Connection check passed")
				return
			}
			if (check.status === "invalid") {
				toast.error(check.diagnostics[0]?.summary ?? "Connection check failed")
				return
			}
			toast.info(check.diagnostics[0]?.summary ?? "Connection status unknown")
		},
		onError: (e) => renderTaggedError(toast, e),
	})

	const deleteMutation = useMutation({
		...deleteProjectIntegrationMutationOptions({ projectSlug, queryClient }),
		onSuccess: () => {
			toast.success("Integration deleted")
			onClose()
		},
		onError: (e) => renderTaggedError(toast, e),
	})

	// Mirrors CreateBody's gating — when the user toggles "Replace credentials"
	// on, the form needs the schema to seed the discriminator before submit.
	const schemaQuery = useQuery(
		integrationSchemaQueryOptions({
			provider: form.provider,
			providerSource: form.providerSource,
			providerVersion: form.providerVersion,
		}),
	)
	const schemaReady = !!form.provider && !schemaQuery.isLoading

	const derived = useMemo(() => {
		if (!integration) {
			return {
				dirty: false,
				rotating: false,
				configChanged: false,
				defaultChanged: false,
			}
		}
		const nameChanged = !!form.name && form.name !== (integration.name ?? "")
		const defaultChanged = form.default && !integration.isDefault
		const configChanged =
			JSON.stringify(form.config) !== JSON.stringify(integration.config ?? {})
		const rotating = form.replaceCredentials
		return {
			dirty: nameChanged || configChanged || rotating || defaultChanged,
			rotating,
			configChanged,
			defaultChanged,
		}
	}, [form, integration])

	function onSubmit(e: FormEvent) {
		e.preventDefault()
		if (!integration) return
		const body: {
			name?: string
			default?: boolean
			credentials?: Record<string, unknown>
			config?: Record<string, unknown>
		} = {}
		if (!!form.name && form.name !== (integration.name ?? ""))
			body.name = form.name
		if (derived.defaultChanged) body.default = true
		if (derived.configChanged) body.config = form.config
		if (derived.rotating) body.credentials = form.credentials
		updateMutation.mutate(body)
	}

	if (isLoading || !integration) {
		return (
			<FloatingPanel
				open={open}
				onClose={onClose}
				title={<span className="text-sm font-medium">Integration</span>}
				subtitle="Loading..."
				closeButtonClassName="hover:bg-transparent dark:hover:bg-transparent"
				placement="center"
				defaultWidth={PANEL_WIDTH}
				defaultHeight={PANEL_HEIGHT}
				defaultHeightHint={PANEL_HEIGHT}
				minWidth={500}
				maxWidth={1200}
			>
				<div className="flex flex-col gap-3 px-4 py-5">
					<Skeleton className="h-6 w-32" />
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
				</div>
			</FloatingPanel>
		)
	}

	const providerMeta = getProviderMeta(integration.provider)

	return (
		<IntegrationSheetBody
			open={open}
			onClose={onClose}
			title={
				<div className="flex min-w-0 items-center gap-2.5">
					<ProviderLogo provider={providerMeta} size="md" />
					<span className="min-w-0 truncate font-mono text-sm">
						{integration.slug}
					</span>
					{integration.isDefault && (
						<Badge
							variant="outline"
							className="shrink-0 px-2 py-0.5 text-[11px] font-light"
						>
							default
						</Badge>
					)}
				</div>
			}
			headerRight={
				integration.providerVersion ? (
					<span className="text-xs font-light text-muted-foreground">
						{integration.providerVersion}
					</span>
				) : undefined
			}
			form={form}
			setForm={setForm}
			sections={EDIT_SECTIONS}
			existing={{
				credentialsMode: integration.credentialsMode,
				isDefault: integration.isDefault,
				onboardingExternalId: integration.onboardingExternalId,
			}}
			checkResult={checkResult}
			innerContent={
				confirmDelete ? (
					<div className="mt-5 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
						<div className="text-sm font-medium text-destructive">
							Delete this integration?
						</div>
						<p className="mt-1 text-sm font-light text-muted-foreground">
							Deletion is blocked while active resources still use this
							integration.
						</p>
						<div className="mt-3 flex justify-end gap-2">
							<Button
								type="button"
								variant="ghost"
								size="xs"
								className="h-7 px-3 text-[11px]"
								onClick={() => setConfirmDelete(false)}
							>
								Cancel
							</Button>
							<Button
								type="button"
								variant="destructive"
								size="xs"
								className="h-7 px-3 text-[11px]"
								onClick={() =>
									deleteMutation.mutate({ slug: integration.slug })
								}
								disabled={deleteMutation.isPending}
							>
								{deleteMutation.isPending ? "Deleting..." : "Delete"}
							</Button>
						</div>
					</div>
				) : null
			}
			leftAction={
				<Button
					type="button"
					variant="outline"
					size="xs"
					className="h-7 px-3"
					onClick={() => setConfirmDelete(true)}
					disabled={deleteMutation.isPending}
				>
					Delete
				</Button>
			}
			test={{
				onClick: () =>
					checkMutation.mutate({
						slug,
						...(derived.rotating ? { credentials: form.credentials } : {}),
						...(derived.configChanged ? { config: form.config } : {}),
					}),
				disabled: checkMutation.isPending,
				pending: checkMutation.isPending,
			}}
			submit={{
				canSubmit: derived.dirty && (!derived.rotating || schemaReady),
				pending: updateMutation.isPending,
				idleLabel: "Save",
				busyLabel: "Saving...",
			}}
			onSubmit={onSubmit}
		/>
	)
}
