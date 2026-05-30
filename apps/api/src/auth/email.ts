// Delivers Better Auth magic-link, organization-invitation, and
// account-deletion-confirmation mails via AWS SES v2. Sending domain
// opsy.sh is verified in us-east-1 and the
// opsy-dev IAM policy scopes ses:SendEmail to SES identities in this
// account. SDK reads region + credentials from the default chain. When
// SES_FROM_ADDRESS is unset, senders log the URL so local dev works
// without AWS creds.

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2"
import { env } from "../lib/env"
import { baseLogger } from "../lib/logger"

const client = new SESv2Client({})
const log = baseLogger.child({ component: "auth-email" })

type Kind = "magic-link" | "invitation" | "delete-account"

const copy: Record<
	Kind,
	{ subject: string; heading: string; cta: string; body: string }
> = {
	"magic-link": {
		subject: "Sign in to Opsy",
		heading: "Sign in to Opsy",
		cta: "Sign in",
		body: "Click the button below to sign in. This link will expire shortly and can only be used once.",
	},
	invitation: {
		subject: "You've been invited to an Opsy workspace",
		heading: "Join the workspace",
		cta: "Accept invitation",
		// Body is built per-call by sendInvitationEmail with the inviter,
		// org, and role interpolated; this default is only a fallback.
		body: "You've been invited to join an organization on Opsy.",
	},
	"delete-account": {
		subject: "Confirm Opsy account deletion",
		heading: "Delete your Opsy account",
		cta: "Delete account",
		body: "Click the button below to permanently delete your Opsy account. This action cannot be undone. If you didn't request this, ignore this email and your account will stay active.",
	},
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
}

function renderHtml(kind: Kind, url: string, body: string): string {
	const { heading, cta } = copy[kind]
	const safeUrl = escapeHtml(url)
	return `<!doctype html>
<html>
<body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#f6f6f6;margin:0;padding:32px">
  <table align="center" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px">
    <tr><td>
      <h1 style="margin:0 0 16px;font-size:20px;color:#111">${heading}</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#444">${body}</p>
      <a href="${safeUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500">${cta}</a>
      <p style="margin:24px 0 0;font-size:12px;color:#888;line-height:1.5">If the button doesn't work, copy and paste this URL into your browser:<br/><span style="color:#555;word-break:break-all">${safeUrl}</span></p>
    </td></tr>
  </table>
</body>
</html>`
}

function renderText(kind: Kind, url: string, body: string): string {
	const { heading } = copy[kind]
	return `${heading}\n\n${body}\n\n${url}\n`
}

async function sendTransactional(
	kind: Kind,
	to: string,
	url: string,
	bodyOverride?: string,
): Promise<void> {
	const body = bodyOverride ?? copy[kind].body
	if (!env.SES_FROM_ADDRESS) {
		log.info({ kind, to, url }, "dev email (SES_FROM_ADDRESS unset)")
		return
	}

	const { subject } = copy[kind]
	await client.send(
		new SendEmailCommand({
			FromEmailAddress: env.SES_FROM_ADDRESS,
			Destination: { ToAddresses: [to] },
			Content: {
				Simple: {
					Subject: { Data: subject, Charset: "UTF-8" },
					Body: {
						Html: { Data: renderHtml(kind, url, body), Charset: "UTF-8" },
						Text: { Data: renderText(kind, url, body), Charset: "UTF-8" },
					},
				},
			},
		}),
	)
}

export async function sendMagicLinkEmail(
	email: string,
	url: string,
): Promise<void> {
	await sendTransactional("magic-link", email, url)
}

export async function sendInvitationEmail(args: {
	to: string
	acceptUrl: string
	organizationName: string
	inviterEmail: string
	role: string
}): Promise<void> {
	const body = `${args.inviterEmail} invited you to join <strong>${args.organizationName}</strong> on Opsy as <strong>${args.role}</strong>. Click the button below to accept the invitation.`
	await sendTransactional("invitation", args.to, args.acceptUrl, body)
}

export async function sendDeleteAccountEmail(
	email: string,
	url: string,
): Promise<void> {
	await sendTransactional("delete-account", email, url)
}
