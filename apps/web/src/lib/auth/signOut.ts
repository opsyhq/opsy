import { authClient } from "@/lib/auth"

// Full-document navigation, not router.navigate(): better-auth's useSession()
// does not clear synchronously (gated behind setTimeout + BroadcastChannel),
// so an SPA nav to /login races the still-truthy session and the route's
// beforeLoad bounces back to "/". A document load re-fetches the cleared
// session before any guard runs and drops all in-memory state.
export async function signOut(): Promise<void> {
	await authClient.signOut()
	window.location.assign("/login")
}
