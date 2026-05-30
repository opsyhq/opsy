import { Cable, Plus } from "lucide-react"
import { useState } from "react"
import { EmptyState } from "@/components/EmptyState"
import { ProviderLogo } from "@/components/ProviderLogo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader } from "@/components/ui/card"
import type { ProjectIntegration } from "@/lib/projectReactQuery"
import { getProviderMeta } from "@/lib/providerMeta"
import {
	IntegrationSheet,
	type IntegrationSheetTarget,
} from "./-IntegrationSheet"

export function ProjectIntegrationsPage({
	slug,
	integrations,
}: {
	slug: string
	integrations: ProjectIntegration[]
}) {
	const [target, setTarget] = useState<IntegrationSheetTarget>(null)

	return (
		<div className="flex flex-col gap-6">
			<div>
				<div className="flex items-center justify-between gap-3">
					<h1 className="text-2xl font-medium tracking-tight">Integrations</h1>
					<Button
						size="xs"
						className="h-7 px-4 text-[11px] has-[>svg]:px-4"
						onClick={() => setTarget("create")}
					>
						<Plus />
						Create Integration
					</Button>
				</div>
				<p className="mt-1 text-sm font-light text-muted-foreground">
					Provider connections available to this project.
				</p>
			</div>

			{integrations.length === 0 && (
				<EmptyState
					icon={Cable}
					title="No integrations"
					description="Create a provider connection before adding resources."
				/>
			)}
			{integrations.length > 0 && (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{integrations.map((i) => {
						const provider = getProviderMeta(i.provider)
						return (
							<Card
								key={i.id}
								onClick={() => setTarget({ slug: i.slug })}
								className="group relative cursor-pointer gap-3 overflow-hidden rounded-lg border bg-background transition-colors hover:bg-muted/30"
							>
								<CardHeader className="flex flex-row items-start gap-3 space-y-0 px-4 -translate-y-2">
									<div className="flex min-w-0 flex-1 items-center gap-2 truncate font-mono text-sm font-medium">
										<ProviderLogo provider={provider} size="sm" />
										<span className="truncate">{i.slug}</span>
									</div>
									{i.isDefault && (
										<Badge variant="outline" className="shrink-0">
											default
										</Badge>
									)}
								</CardHeader>
								<div className="flex translate-y-2 justify-end pl-4 pr-[25px] text-xs font-light text-muted-foreground">
									{i.providerVersion ?? "default"}
								</div>
							</Card>
						)
					})}
				</div>
			)}

			<IntegrationSheet
				projectSlug={slug}
				target={target}
				onOpenChange={(o) => !o && setTarget(null)}
			/>
		</div>
	)
}
