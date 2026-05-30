import { isOpsyError, type OpsyError } from "@opsy/contracts/errors"

type ToastFn = (message: string, opts?: { description?: string }) => void

export type Toast = {
	success: ToastFn
	error: ToastFn
	info: ToastFn
}

// Tag-keyed UX hints. Tags absent here fall through to the bare message.
const TAG_DESCRIPTIONS: Partial<Record<OpsyError["_tag"], string>> = {
	OperationLockAlreadyInflight:
		"Another operation is already running on this resource. Wait for it to finish or cancel it.",
	OperationNotFound: "The operation no longer exists.",
	AuthUnauthorized: "Sign in to continue.",
	AuthNoActiveOrg: "No active organization. Pick one and try again.",
	ResourceNotFound: "The resource no longer exists.",
	ProjectNotFound: "The project no longer exists.",
	IntegrationNotFound: "The integration no longer exists.",
	IntegrationNoDefault:
		"No default integration for this provider. Create one or mark an existing one as default.",
	IntegrationProviderMismatch:
		"That integration belongs to a different provider.",
	BridgePhaseFailed: "The provider call failed mid-phase.",
}

export function renderTaggedError(toast: Toast, err: unknown): void {
	if (isOpsyError(err)) {
		const description = TAG_DESCRIPTIONS[err._tag]
		toast.error(err.message, description ? { description } : undefined)
		return
	}
	const message = err instanceof Error ? err.message : String(err)
	toast.error(message)
}
