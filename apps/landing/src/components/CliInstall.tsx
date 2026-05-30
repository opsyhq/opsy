import { usePostHog } from "@posthog/react"
import { Check, Copy } from "lucide-react"
import { useState } from "react"

const INSTALL_CMD = "npm install -g @opsyhq/opsy"

/** Click-to-copy install command for the published CLI (@opsyhq/opsy). */
export function CliInstall() {
	const posthog = usePostHog()
	const [copied, setCopied] = useState(false)

	const copy = () => {
		void navigator.clipboard?.writeText(INSTALL_CMD)
		posthog.capture("cli_install_copied", { command: INSTALL_CMD })
		setCopied(true)
		setTimeout(() => setCopied(false), 1800)
	}

	return (
		<button
			type="button"
			className="cli"
			onClick={copy}
			aria-label={copied ? "Copied" : "Copy install command"}
		>
			<span className="cli-prompt" aria-hidden>
				$
			</span>
			<code className="cli-cmd">{INSTALL_CMD}</code>
			<span className="cli-copy" aria-hidden>
				{copied ? (
					<Check size={14} strokeWidth={2.5} />
				) : (
					<Copy size={14} strokeWidth={2.25} />
				)}
			</span>
		</button>
	)
}
