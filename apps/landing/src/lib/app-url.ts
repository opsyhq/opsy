/** Web app dev server (apps/web runs Vite on its default port). */
const DEV_APP_URL = "http://localhost:5173"

/**
 * Base URL of the web app. Source of truth is `VITE_APP_URL`, set per
 * environment in CI (.github/workflows/deploy-landing.yml):
 * production → https://app.opsy.sh, staging → https://staging.app.opsy.sh.
 * It is unset locally, so dev falls back to the web dev server. The value is
 * inlined at build time, so it is identical on the server and the client (no
 * host heuristic, no hydration mismatch).
 */
function appBaseUrl(): string {
	const v = import.meta.env.VITE_APP_URL as string | undefined
	return v ? v.replace(/\/+$/, "") : DEV_APP_URL
}

/** Login URL for the CTA. */
export function appLoginUrl(): string {
	return `${appBaseUrl()}/login`
}
