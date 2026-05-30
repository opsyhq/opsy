import { useMutation } from "@tanstack/react-query"
import { Loader2, Radar } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	scanProjectMutationOptions,
	updateProjectMutationOptions,
} from "@/lib/projectReactQuery"
import { queryClient } from "@/lib/query"

type PolicyChoice = "none" | "on_destroy" | "always"
type ScanInterval = "off" | "hourly" | "daily"

function arrayToChoice(policy: string[]): PolicyChoice {
	if (policy.includes("always")) return "always"
	if (policy.includes("on_destroy")) return "on_destroy"
	return "none"
}

function choiceToArray(choice: PolicyChoice): string[] {
	return choice === "none" ? [] : [choice]
}

export function ProjectSettingsPage({
	slug,
	currentPolicy,
	currentScanInterval,
}: {
	slug: string
	currentPolicy: string[]
	currentScanInterval: ScanInterval
}) {
	const [policy, setPolicy] = useState<PolicyChoice>(
		arrayToChoice(currentPolicy),
	)
	const [scanInterval, setScanInterval] =
		useState<ScanInterval>(currentScanInterval)

	const updateProject = useMutation({
		...updateProjectMutationOptions({ slug, queryClient }),
		onSuccess: () => toast.success("Settings saved"),
	})
	const scanProject = useMutation({
		...scanProjectMutationOptions({ slug, queryClient }),
		onSuccess: () => toast.success("Scan started"),
	})

	const policyDirty = policy !== arrayToChoice(currentPolicy)
	const scanIntervalDirty = scanInterval !== currentScanInterval
	const dirty = policyDirty || scanIntervalDirty

	return (
		<div>
			<h2 className="text-2xl font-medium tracking-tight">Project Settings</h2>
			<p className="mt-1 text-sm font-light text-muted-foreground">
				Configure approval policies and project-wide scanning.
			</p>

			<div className="mt-8 flex flex-col gap-8">
				<div className="flex flex-col gap-2">
					<Label>Approval Policy</Label>
					<Select
						value={policy}
						onValueChange={(v) => setPolicy(v as PolicyChoice)}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">None</SelectItem>
							<SelectItem value="on_destroy">On Destroy</SelectItem>
							<SelectItem value="always">Always</SelectItem>
						</SelectContent>
					</Select>
					<p className="pl-3 text-xs text-muted-foreground/70">
						{policy === "none" &&
							"Operations run immediately without approval."}
						{policy === "on_destroy" &&
							"Delete operations require approval before executing."}
						{policy === "always" &&
							"All mutating operations (create, update, delete) require approval."}
					</p>
				</div>

				<div className="flex flex-col gap-2">
					<Label>Scan Interval</Label>
					<Select
						value={scanInterval}
						onValueChange={(v) => setScanInterval(v as ScanInterval)}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="off">Off</SelectItem>
							<SelectItem value="hourly">Hourly</SelectItem>
							<SelectItem value="daily">Daily</SelectItem>
						</SelectContent>
					</Select>
					<p className="pl-3 text-xs text-muted-foreground/70">
						{scanInterval === "off" && "Scheduled scans are disabled."}
						{scanInterval === "hourly" &&
							"Project resources are scanned every hour."}
						{scanInterval === "daily" &&
							"Project resources are scanned once per day."}
					</p>
					<div>
						<Button
							type="button"
							variant="outline"
							size="xs"
							className="h-7 px-3 text-[11px]"
							onClick={() => scanProject.mutate()}
							disabled={scanProject.isPending}
						>
							{scanProject.isPending ? (
								<Loader2 className="size-3 animate-spin" />
							) : (
								<Radar className="size-3" />
							)}
							{scanProject.isPending ? "Scanning..." : "Scan now"}
						</Button>
					</div>
				</div>
			</div>

			<div className="mt-8 flex justify-end">
				<Button
					size="xs"
					className="h-7 px-4 text-[11px]"
					onClick={() =>
						updateProject.mutate({
							...(policyDirty ? { approvalPolicy: choiceToArray(policy) } : {}),
							...(scanIntervalDirty ? { scanInterval } : {}),
						})
					}
					disabled={!dirty || updateProject.isPending}
				>
					{updateProject.isPending ? "Saving..." : "Save"}
				</Button>
			</div>
		</div>
	)
}
