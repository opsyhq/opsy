import { Data } from "effect"

export class AuthOnboardingDisabled extends Data.TaggedError(
	"AuthOnboardingDisabled",
) {
	get message() {
		return "Onboarding is disabled when AUTH_SKIP is set."
	}
}

export class AuthOnboardingInvalidPayload extends Data.TaggedError(
	"AuthOnboardingInvalidPayload",
)<{ detail: string }> {
	get message() {
		return this.detail
	}
}

export class AuthOnboardingOrgExists extends Data.TaggedError(
	"AuthOnboardingOrgExists",
) {
	get message() {
		return "User already has an active organization."
	}
}

export class AuthUnauthorized extends Data.TaggedError("AuthUnauthorized") {
	get message() {
		return "Unauthorized"
	}
}

export class AuthApiKeyInvalid extends Data.TaggedError("AuthApiKeyInvalid") {
	get message() {
		return "Invalid API key"
	}
}

export class AuthApiKeyNoOrg extends Data.TaggedError("AuthApiKeyNoOrg") {
	get message() {
		return "API key not bound to an organization"
	}
}

export class AuthNoActiveOrg extends Data.TaggedError("AuthNoActiveOrg") {
	get message() {
		return "No active organization"
	}
}

// Device-flow oauth errors surfaced by `opsy auth login`. Each maps to a
// distinct OAuth 2.0 device-authorization error code (RFC 8628 §3.5).
export class AuthDeviceCodeRequestFailed extends Data.TaggedError(
	"AuthDeviceCodeRequestFailed",
)<{ detail: string }> {
	get message() {
		return `Failed to request device code: ${this.detail}`
	}
}

export class AuthDeviceCodeExpired extends Data.TaggedError(
	"AuthDeviceCodeExpired",
) {
	get message() {
		return "Device code expired. Please try again."
	}
}

export class AuthDeviceCodeAccessDenied extends Data.TaggedError(
	"AuthDeviceCodeAccessDenied",
) {
	get message() {
		return "Access denied."
	}
}

export class AuthDeviceCodeInvalidGrant extends Data.TaggedError(
	"AuthDeviceCodeInvalidGrant",
) {
	get message() {
		return "Invalid device code."
	}
}

export class AuthDeviceCodeInvalidRequest extends Data.TaggedError(
	"AuthDeviceCodeInvalidRequest",
)<{ detail: string }> {
	get message() {
		return this.detail
	}
}

export class AuthDeviceCodePollFailed extends Data.TaggedError(
	"AuthDeviceCodePollFailed",
)<{ detail: string }> {
	get message() {
		return `Authentication error: ${this.detail}`
	}
}

export class AuthDeviceCodeTimeout extends Data.TaggedError(
	"AuthDeviceCodeTimeout",
) {
	get message() {
		return "Authentication timed out."
	}
}

export type AuthError =
	| AuthApiKeyInvalid
	| AuthApiKeyNoOrg
	| AuthDeviceCodeAccessDenied
	| AuthDeviceCodeExpired
	| AuthDeviceCodeInvalidGrant
	| AuthDeviceCodeInvalidRequest
	| AuthDeviceCodePollFailed
	| AuthDeviceCodeRequestFailed
	| AuthDeviceCodeTimeout
	| AuthNoActiveOrg
	| AuthOnboardingDisabled
	| AuthOnboardingInvalidPayload
	| AuthOnboardingOrgExists
	| AuthUnauthorized
