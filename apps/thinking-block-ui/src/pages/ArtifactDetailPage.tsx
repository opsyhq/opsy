import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "@tanstack/react-router"
import { CopyButton } from "@/components/CopyButton"
import { JsonBlock, MarkdownBlock } from "@/components/JsonBlock"
import { EmptyState, ErrorState, InlineSpinner } from "@/components/PageState"
import { StatusBadge } from "@/components/StatusBadge"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDateTime, formatDuration, truncateMiddle } from "@/lib/format"
import {
	type ArtifactDetail,
	getArtifactDetail,
	type ModelCall,
} from "@/lib/thinking-block-api"

export function ArtifactDetailPage() {
	const { artifactId } = useParams({ strict: false }) as { artifactId: string }
	const query = useQuery({
		queryKey: ["thinking-block-artifact-detail", artifactId],
		queryFn: () => getArtifactDetail(artifactId),
		refetchInterval: (state) => {
			const status = state.state.data?.artifact.status
			return status === "pending" || status === "running" ? 2000 : false
		},
	})

	if (query.isLoading) return <InlineSpinner label="Loading artifact" />
	if (query.isError) return <ErrorState error={query.error} />
	if (!query.data) return <EmptyState title="Artifact not found" />

	const detail = query.data
	const artifact = detail.artifact
	const hasTraceEvents = detail.aiSdkTrace.events.length > 0

	return (
		<section className="space-y-4">
			<div className="rounded-lg border bg-background">
				<div className="flex flex-col gap-3 p-4">
					<div className="text-xs text-muted-foreground">
						<Link to="/" className="hover:text-foreground">
							Blocks
						</Link>
						<span className="px-2">/</span>
						<Link
							to="/blocks/$blockName"
							params={{ blockName: artifact.blockName }}
							className="hover:text-foreground"
						>
							{artifact.blockName}
						</Link>
					</div>
					<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
						<div className="min-w-0 space-y-2">
							<div className="flex min-w-0 items-center gap-2">
								<h1 className="truncate font-mono text-lg font-semibold tracking-normal">
									{artifact.id}
								</h1>
								<CopyButton
									value={artifact.id}
									label="Copy artifact ID"
									className="size-7"
								/>
							</div>
							<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
								<StatusBadge status={artifact.status} />
								<span>{artifact.blockVersion}</span>
								<span className="font-mono">
									{truncateMiddle(artifact.identityKey, 18)}
								</span>
								<CopyButton
									value={artifact.identityKey}
									label="Copy identity key"
									className="size-6"
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
							<Metric label="Runs" value={detail.runs.length} />
							<Metric label="Calls" value={detail.modelCalls.length} />
							<Metric label="Validations" value={detail.validations.length} />
							<Metric
								label="Duration"
								value={formatDuration(
									detail.runs.findLast((run) => run.durationMs !== null)
										?.durationMs,
								)}
							/>
						</div>
					</div>
				</div>
			</div>

			<Tabs defaultValue="input" className="rounded-lg border bg-background">
				<div className="overflow-x-auto border-b px-3 pt-3">
					<TabsList variant="line" className="min-w-max">
						<TabsTrigger value="input">Input</TabsTrigger>
						<TabsTrigger value="model-calls">Generation</TabsTrigger>
						<TabsTrigger value="output">Output</TabsTrigger>
						<TabsTrigger value="runs">Runs</TabsTrigger>
						<TabsTrigger value="validations">Validation</TabsTrigger>
						<TabsTrigger value="history">History</TabsTrigger>
						<TabsTrigger value="error">Rejection/Error</TabsTrigger>
						<TabsTrigger value="lineage">Lineage</TabsTrigger>
						{hasTraceEvents ? (
							<TabsTrigger value="trace">AI SDK Trace</TabsTrigger>
						) : null}
					</TabsList>
				</div>
				<TabsContent value="input" className="m-0 space-y-4 p-4">
					<JsonBlock
						title="Artifact Input"
						value={artifact.input}
						defaultOpen
						copyLabel="Copy input JSON"
					/>
				</TabsContent>
				<TabsContent value="output" className="m-0 space-y-4 p-4">
					<JsonBlock
						title="Parsed Artifact Output"
						value={artifact.output}
						defaultOpen
						copyLabel="Copy output JSON"
					/>
					{hasJsonValue(artifact.rejection) ? (
						<JsonBlock
							title="Rejection"
							value={artifact.rejection}
							copyLabel="Copy rejection JSON"
						/>
					) : null}
					{hasJsonValue(artifact.error) ? (
						<JsonBlock
							title="Error"
							value={artifact.error}
							copyLabel="Copy artifact error JSON"
						/>
					) : null}
				</TabsContent>
				<TabsContent value="runs" className="m-0 space-y-4 p-4">
					<RunsTable runs={detail.runs} />
				</TabsContent>
				<TabsContent value="model-calls" className="m-0 space-y-4 p-4">
					<ModelCalls calls={detail.modelCalls} />
				</TabsContent>
				<TabsContent value="validations" className="m-0 space-y-4 p-4">
					<Validations detail={detail} />
				</TabsContent>
				<TabsContent value="history" className="m-0 space-y-4 p-4">
					<History detail={detail} />
				</TabsContent>
				<TabsContent value="error" className="m-0 space-y-4 p-4">
					<ErrorRejection detail={detail} />
				</TabsContent>
				<TabsContent value="lineage" className="m-0 space-y-4 p-4">
					<Lineage detail={detail} />
				</TabsContent>
				{hasTraceEvents ? (
					<TabsContent value="trace" className="m-0 space-y-4 p-4">
						<JsonBlock
							title="AI SDK Trace Events"
							value={detail.aiSdkTrace.events}
							defaultOpen
						/>
					</TabsContent>
				) : null}
			</Tabs>
		</section>
	)
}

function Metric({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-md border px-3 py-2">
			<div className="text-xs text-muted-foreground">{label}</div>
			<div className="font-mono text-sm">{value}</div>
		</div>
	)
}

function History({ detail }: { detail: ArtifactDetail }) {
	const artifact = detail.artifact
	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
			<section className="space-y-3">
				<h2 className="text-sm font-semibold">Status History</h2>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Status</TableHead>
							<TableHead>At</TableHead>
							<TableHead>Source</TableHead>
							<TableHead>Run</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{detail.statusHistory.map((event) => (
							<TableRow
								key={`${event.source}-${event.status}-${event.at}-${event.runId ?? event.label}`}
							>
								<TableCell>
									<StatusBadge status={event.status} />
								</TableCell>
								<TableCell>{formatDateTime(event.at)}</TableCell>
								<TableCell>{event.label}</TableCell>
								<TableCell className="font-mono text-xs">
									{event.runId ? (
										<div className="flex items-center gap-1">
											<span>{truncateMiddle(event.runId, 8)}</span>
											<CopyButton
												value={event.runId}
												label="Copy run ID"
												className="size-6"
											/>
										</div>
									) : (
										"-"
									)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</section>
			<section className="space-y-3">
				<h2 className="text-sm font-semibold">Identity</h2>
				<div className="grid gap-2">
					<Metric label="Block version" value={artifact.blockVersion} />
					<Metric label="Identity key" value={artifact.identityKey} />
					<Metric label="Created" value={formatDateTime(artifact.createdAt)} />
					<Metric label="Updated" value={formatDateTime(artifact.updatedAt)} />
					<Metric label="Ready" value={formatDateTime(artifact.readyAt)} />
					<Metric
						label="Phase"
						value={artifact.phaseLabel ?? artifact.phase ?? "-"}
					/>
				</div>
			</section>
		</div>
	)
}

function RunsTable({ runs }: { runs: ArtifactDetail["runs"] }) {
	if (runs.length === 0) return <EmptyState title="No runs recorded" />
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Run</TableHead>
					<TableHead>Status</TableHead>
					<TableHead>Trigger</TableHead>
					<TableHead>Started</TableHead>
					<TableHead>Finished</TableHead>
					<TableHead>Duration</TableHead>
					<TableHead>Metadata</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{runs.map((run) => (
					<TableRow key={run.id}>
						<TableCell className="font-mono text-xs">
							<div className="flex items-center gap-1">
								<span>{truncateMiddle(run.id, 8)}</span>
								<CopyButton
									value={run.id}
									label="Copy run ID"
									className="size-6"
								/>
							</div>
						</TableCell>
						<TableCell>
							<StatusBadge status={run.status} />
						</TableCell>
						<TableCell>{run.trigger ?? "-"}</TableCell>
						<TableCell>{formatDateTime(run.startedAt)}</TableCell>
						<TableCell>{formatDateTime(run.finishedAt)}</TableCell>
						<TableCell>{formatDuration(run.durationMs)}</TableCell>
						<TableCell>
							<JsonBlock title="Metadata" value={run.metadata} />
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	)
}

function ModelCalls({ calls }: { calls: ModelCall[] }) {
	if (calls.length === 0) return <EmptyState title="No model calls recorded" />
	const invocations = modelCallInvocations(calls)
	return (
		<div className="space-y-3">
			{invocations.map((invocation, index) => {
				const firstStep = invocation.steps[0]
				if (!firstStep) return null
				const prompt = firstStep.input.prompt
				const messages = firstStep.input.messages
				const settings = modelSettings(
					firstStep.input.options,
					prompt,
					messages,
				)
				const status = invocation.steps.some((step) => step.status === "error")
					? "error"
					: "success"
				const openPrimary = index === 0
				return (
					<section className="rounded-lg border" key={invocation.key}>
						<div className="flex flex-col gap-2 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
							<div className="min-w-0">
								<div className="flex items-center gap-2 text-sm font-medium">
									<span>Invocation {index + 1}</span>
									<span className="text-muted-foreground">/</span>
									<span>{firstStep.provider}</span>
									<span className="text-muted-foreground">/</span>
									<span>{firstStep.model}</span>
									<StatusBadge status={status} />
								</div>
								<div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
									<span>{firstStep.role}</span>
									<span>attempt {firstStep.attempt + 1}</span>
									<span>
										{invocation.steps.length}{" "}
										{invocation.steps.length === 1 ? "step" : "steps"}
									</span>
									{firstStep.responseModel ? (
										<span>{firstStep.responseModel}</span>
									) : null}
								</div>
							</div>
							<div className="flex items-center gap-1">
								<span className="font-mono text-xs text-muted-foreground">
									{truncateMiddle(firstStep.id, 8)}
								</span>
								<CopyButton
									value={firstStep.id}
									label="Copy first step ID"
									className="size-6"
								/>
								{firstStep.runId ? (
									<CopyButton
										value={firstStep.runId}
										label="Copy run ID"
										className="size-6"
									/>
								) : null}
							</div>
						</div>
						<div className="grid gap-3 p-3 xl:grid-cols-2">
							{hasJsonValue(firstStep.instructions) ? (
								<MarkdownBlock
									title="Instructions"
									value={firstStep.instructions}
									defaultOpen={openPrimary}
									copyLabel="Copy instructions"
								/>
							) : null}
							{hasJsonValue(prompt) ? (
								<MarkdownBlock
									title={firstStep.role === "judge" ? "Judge Prompt" : "Prompt"}
									value={prompt}
									defaultOpen={openPrimary}
									copyLabel="Copy prompt"
								/>
							) : null}
							{hasJsonValue(messages) ? (
								<JsonBlock
									title={
										firstStep.role === "judge" ? "Judge Messages" : "Messages"
									}
									value={messages}
									defaultOpen={openPrimary}
									copyLabel="Copy messages JSON"
								/>
							) : null}
							<JsonBlock
								title="Model Settings"
								value={settings}
								copyLabel="Copy options JSON"
							/>
							<div className="space-y-3 xl:col-span-2">
								{invocation.steps.map((step) => (
									<MarkdownBlock
										title={`Step ${step.stepIndex + 1} Response`}
										value={step.output}
										defaultOpen={openPrimary}
										copyLabel="Copy step output JSON"
										key={step.id}
									/>
								))}
							</div>
							{invocation.steps.some((step) => hasJsonValue(step.error)) ? (
								<JsonBlock
									title="Error"
									value={invocation.steps.map((step) => ({
										stepIndex: step.stepIndex,
										error: step.error,
									}))}
									copyLabel="Copy model error JSON"
								/>
							) : null}
							<JsonBlock title="Raw Request" value={firstStep.input} />
							<JsonBlock
								title="Step Metadata"
								value={invocation.steps.map((step) => ({
									id: step.id,
									stepIndex: step.stepIndex,
									metadata: step.metadata,
								}))}
							/>
						</div>
					</section>
				)
			})}
		</div>
	)
}

type ModelCallInvocation = {
	key: string
	steps: ModelCall[]
}

function modelCallInvocations(calls: ModelCall[]): ModelCallInvocation[] {
	const invocations = new Map<string, ModelCallInvocation>()
	for (const call of calls) {
		const key = JSON.stringify({
			runId: call.runId,
			operationId: call.operationId,
			blockName: call.blockName,
			attempt: call.attempt,
			role: call.role,
			validatorId: call.validatorId,
			validatorType: call.validatorType,
			prompt: call.input.prompt,
			options: call.input.options,
		})
		const invocation = invocations.get(key)
		if (invocation) {
			invocation.steps.push(call)
		} else {
			invocations.set(key, { key, steps: [call] })
		}
	}
	return Array.from(invocations.values())
}

function Validations({ detail }: { detail: ArtifactDetail }) {
	if (detail.validations.length === 0) {
		return <EmptyState title="No validations recorded" />
	}
	return (
		<div className="space-y-3">
			{detail.validations.map((validation) => (
				<section className="rounded-lg border" key={validation.id}>
					<div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
						<div className="flex items-center gap-2 text-sm font-medium">
							<span>{validation.validatorId}</span>
							<StatusBadge status={validation.status} />
							<span className="text-xs text-muted-foreground">
								{validation.validatorType}
							</span>
						</div>
						<div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
							<span>{truncateMiddle(validation.id, 8)}</span>
							{validation.runId ? (
								<CopyButton
									value={validation.runId}
									label="Copy run ID"
									className="size-6"
								/>
							) : null}
						</div>
					</div>
					<div className="grid gap-3 p-3 lg:grid-cols-2">
						<JsonBlock
							title="Feedback"
							value={validation.feedback}
							defaultOpen
						/>
						<JsonBlock title="Metadata" value={validation.metadata} />
					</div>
				</section>
			))}
		</div>
	)
}

function ErrorRejection({ detail }: { detail: ArtifactDetail }) {
	const runProblems = detail.runs.filter(
		(run) =>
			run.rejectionReason ||
			hasJsonValue(run.rejection) ||
			hasJsonValue(run.error),
	)
	if (
		!hasJsonValue(detail.artifact.rejection) &&
		!hasJsonValue(detail.artifact.error) &&
		runProblems.length === 0
	) {
		return <EmptyState title="No rejection or error recorded" />
	}
	return (
		<div className="grid gap-3 lg:grid-cols-2">
			{hasJsonValue(detail.artifact.rejection) ? (
				<JsonBlock title="Rejection" value={detail.artifact.rejection} />
			) : null}
			{hasJsonValue(detail.artifact.error) ? (
				<JsonBlock title="Error" value={detail.artifact.error} />
			) : null}
			{runProblems.map((run) => (
				<JsonBlock
					title={`Run ${truncateMiddle(run.id, 6)}`}
					value={{
						rejectionReason: run.rejectionReason,
						rejection: run.rejection,
						error: run.error,
					}}
					key={run.id}
				/>
			))}
		</div>
	)
}

function hasJsonValue(value: unknown): boolean {
	if (value === undefined || value === null) return false
	if (typeof value === "string") return value.trim().length > 0
	if (Array.isArray(value)) return value.length > 0
	if (typeof value === "object") return Object.keys(value).length > 0
	return true
}

function modelSettings(
	options: unknown,
	prompt: unknown,
	messages: unknown,
): unknown {
	if (!options || typeof options !== "object" || Array.isArray(options)) {
		return options ?? null
	}
	const settings = options as Record<string, unknown>
	const entries = Object.entries(settings).filter(([key, value]) => {
		const keyName = key.toLowerCase()
		if (keyName.includes("prompt")) {
			return JSON.stringify(value) !== JSON.stringify(prompt)
		}
		if (keyName.includes("messages")) {
			return JSON.stringify(value) !== JSON.stringify(messages)
		}
		return true
	})
	return Object.fromEntries(entries)
}

function Lineage({ detail }: { detail: ArtifactDetail }) {
	return (
		<div className="space-y-4">
			<div className="grid gap-3 md:grid-cols-2">
				<Metric
					label="Superseded by"
					value={detail.lineage.supersededBy ?? "-"}
				/>
				<Metric
					label="Superseded at"
					value={formatDateTime(detail.lineage.supersededAt)}
				/>
			</div>
			{detail.lineage.supersededArtifacts.length === 0 ? (
				<EmptyState title="No superseded artifacts" />
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Artifact</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Created</TableHead>
							<TableHead>Updated</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{detail.lineage.supersededArtifacts.map((artifact) => (
							<TableRow key={artifact.id}>
								<TableCell className="font-mono text-xs">
									<div className="flex items-center gap-1">
										<Link
											to="/artifacts/$artifactId"
											params={{ artifactId: artifact.id }}
											className="hover:underline"
										>
											{truncateMiddle(artifact.id, 8)}
										</Link>
										<CopyButton
											value={artifact.id}
											label="Copy artifact ID"
											className="size-6"
										/>
									</div>
								</TableCell>
								<TableCell>
									<StatusBadge status={artifact.status} />
								</TableCell>
								<TableCell>{formatDateTime(artifact.createdAt)}</TableCell>
								<TableCell>{formatDateTime(artifact.updatedAt)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</div>
	)
}
