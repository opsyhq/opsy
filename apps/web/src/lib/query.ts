import { QueryClient } from "@tanstack/react-query"
import { toast as sonner } from "sonner"
import { renderTaggedError, type Toast } from "@/errors/error-toast"

// QueryClient is constructed before any component-level wiring runs, so the
// global mutation handler binds straight to sonner. error-toast.ts stays
// decoupled (takes any Toast); other callers can import sonner directly.
const globalToast: Toast = {
	success: (message, opts) => sonner.success(message, opts),
	error: (message, opts) => sonner.error(message, opts),
	info: (message, opts) => sonner.info(message, opts),
}

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: { staleTime: 30_000, retry: 1 },
		mutations: { onError: (err) => renderTaggedError(globalToast, err) },
	},
})
