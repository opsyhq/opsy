import type { ProviderIntegrationOnboardingMetadata } from "@opsy/provider"
import { useQuery } from "@tanstack/react-query"
import { Check, ChevronRight, Copy } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { providerOnboardingQueryOptions } from "@/lib/integrationReactQuery"

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false)
	return (
		<Button
			type="button"
			size="xs"
			variant="outline"
			className="h-7 px-3 text-[11px]"
			onClick={async () => {
				await navigator.clipboard.writeText(text)
				setCopied(true)
				setTimeout(() => setCopied(false), 1500)
			}}
		>
			{copied ? <Check className="size-3" /> : <Copy className="size-3" />}
			{copied ? "Copied" : "Copy"}
		</Button>
	)
}

function Step({
	n,
	title,
	children,
}: {
	n: number
	title: string
	children?: React.ReactNode
}) {
	return (
		<li className="grid grid-cols-[1.25rem_1fr] gap-x-3 gap-y-2">
			<span className="pt-0.5 text-right text-xs font-light tabular-nums text-muted-foreground/70">
				{n}
			</span>
			<div className="text-sm font-light">{title}</div>
			{children ? <div className="col-start-2">{children}</div> : null}
		</li>
	)
}

// Trust policy + permissions policy, copyable. Shared by the manual path and
// the one-click fallback so there is one rendering of each artifact.
function ManualSteps({
	documentLabel,
	document,
	permissionsPolicyArn,
}: {
	documentLabel: string
	document: string
	permissionsPolicyArn: string | null
}) {
	return (
		<ol className="grid gap-4">
			<Step
				n={1}
				title="Create a new IAM role in your AWS account (custom trust policy)."
			/>
			<Step
				n={2}
				title={`Paste this as the role's ${documentLabel.toLowerCase()}:`}
			>
				<div className="grid gap-2">
					<div className="flex justify-end">
						<CopyButton text={document} />
					</div>
					<pre className="overflow-x-auto rounded-md border bg-muted p-3 font-mono text-xs">
						{document}
					</pre>
				</div>
			</Step>
			{permissionsPolicyArn ? (
				<Step
					n={3}
					title="Attach this AWS-managed permissions policy (or a narrower one):"
				>
					<div className="flex items-center gap-2">
						<code className="flex-1 overflow-x-auto rounded-md border bg-muted px-2 py-1.5 font-mono text-xs">
							{permissionsPolicyArn}
						</code>
						<CopyButton text={permissionsPolicyArn} />
					</div>
				</Step>
			) : null}
			<Step
				n={permissionsPolicyArn ? 4 : 3}
				title="Paste the new role's ARN into the Role ARN field above."
			/>
		</ol>
	)
}

export function IntegrationOnboarding({
	onboarding,
	provider,
	providerSource,
	providerVersion,
	externalId,
}: {
	onboarding: ProviderIntegrationOnboardingMetadata
	provider: string
	providerSource?: string
	providerVersion?: string
	externalId: string
}) {
	const query = useQuery(
		providerOnboardingQueryOptions({
			provider,
			providerSource,
			providerVersion,
			onboardingKind: onboarding.kind,
			externalId,
		}),
	)
	const data = query.data
	const [showManual, setShowManual] = useState(false)

	return (
		<section className="grid gap-4 rounded-[10px] border bg-background p-5">
			<h3 className="text-sm font-medium">{onboarding.title}</h3>
			<p className="text-sm font-light text-muted-foreground">
				{onboarding.description}
			</p>

			{query.isLoading ? (
				<p className="text-xs text-muted-foreground/70">Loading...</p>
			) : !data?.principalArn || !data.document ? (
				<p className="text-xs font-light text-destructive">
					{onboarding.unavailableMessage}
				</p>
			) : data.cloudformation ? (
				<>
					<ol className="grid gap-4">
						<Step
							n={1}
							title="Create the role in AWS — the link opens CloudFormation pre-filled. Review and create the stack (~1 min)."
						>
							<Button
								asChild
								variant="outline"
								size="xs"
								className="h-7 px-3 text-[11px]"
							>
								<a
									href={data.cloudformation.launchUrl}
									target="_blank"
									rel="noopener noreferrer"
								>
									Launch CloudFormation
								</a>
							</Button>
						</Step>
						<Step
							n={2}
							title="When the stack finishes, open its Outputs tab and copy the RoleArn value."
						/>
						<Step n={3} title="Paste that ARN into the Role ARN field above." />
					</ol>

					<div className="border-t pt-3">
						<button
							type="button"
							onClick={() => setShowManual((v) => !v)}
							className="flex items-center gap-1 text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
						>
							<ChevronRight
								className={`size-3 transition-transform ${
									showManual ? "rotate-90" : ""
								}`}
							/>
							Set it up manually instead
						</button>
						{showManual ? (
							<div className="pt-4">
								<ManualSteps
									documentLabel={onboarding.documentLabel}
									document={data.document}
									permissionsPolicyArn={data.permissionsPolicyArn}
								/>
							</div>
						) : null}
					</div>
				</>
			) : (
				<ManualSteps
					documentLabel={onboarding.documentLabel}
					document={data.document}
					permissionsPolicyArn={data.permissionsPolicyArn}
				/>
			)}
		</section>
	)
}

