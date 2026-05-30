export const artifactStatuses = [
	"pending",
	"running",
	"ready",
	"rejected",
	"failed",
	"superseded",
] as const

export type ArtifactStatus = (typeof artifactStatuses)[number]
export type StatusCounts = Record<ArtifactStatus, number>
export type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue }

export type DurationSummary = {
	avgMs: number | null
	p95Ms: number | null
}

export type BlockSummary = {
	blockName: string
	totalArtifacts: number
	statusCounts: StatusCounts
	latestActivityAt: string | null
	duration: DurationSummary
}

export type ResourceSummary = {
	identityRef: string
	blockName: string
	blockVersion: string
	identityKey: string
	totalArtifacts: number
	statusCounts: StatusCounts
	latestArtifactId: string | null
	latestStatus: ArtifactStatus | null
	latestPhase: string | null
	latestPhaseLabel: string | null
	latestUpdatedAt: string | null
	latestDurationMs: number | null
	duration: DurationSummary
}

export type ArtifactVersion = {
	id: string
	blockName: string
	blockVersion: string
	identityRef: string
	identityKey: string
	status: ArtifactStatus
	phase: string | null
	phaseLabel: string | null
	phaseAt: string | null
	createdAt: string | null
	updatedAt: string | null
	readyAt: string | null
	supersededBy: string | null
	supersededAt: string | null
	runCount: number
	modelCallCount: number
	validationCount: number
	latestDurationMs: number | null
	input?: JsonValue
	output?: JsonValue
	rejection?: JsonValue
	error?: JsonValue
}

export type ArtifactRun = {
	id: string
	artifactId: string | null
	blockName: string
	status: string
	trigger: string | null
	rejectionReason: string | null
	rejection: JsonValue
	metadata: JsonValue
	error: JsonValue
	startedAt: string | null
	finishedAt: string | null
	durationMs: number | null
	createdAt: string | null
	updatedAt: string | null
}

export type ModelCall = {
	id: string
	runId: string | null
	operationId: string | null
	attempt: number
	stepIndex: number
	role: string
	blockName: string
	provider: string
	model: string
	responseModel: string | null
	status: string
	artifactType: string | null
	artifactId: string | null
	metadata: JsonValue
	input: {
		prompt?: unknown
		messages?: unknown
		options?: unknown
		[key: string]: unknown
	}
	instructions: string | null
	instructionsHash: string | null
	output: JsonValue
	error: JsonValue
	validatorId: string | null
	validatorType: string | null
	createdAt: string | null
}

export type ValidationResult = {
	id: string
	runId: string | null
	operationId: string | null
	attempt: number
	validatorId: string
	validatorType: string
	status: string
	feedback: JsonValue
	metadata: JsonValue
	createdAt: string | null
}

export type StatusHistoryEvent = {
	status: ArtifactStatus
	at: string | null
	source: "artifact" | "run"
	label: string
	runId?: string
}

export type ArtifactDetail = {
	artifact: {
		id: string
		blockName: string
		blockVersion: string
		identityRef: string
		identityKey: string
		status: ArtifactStatus
		phase: string | null
		phaseLabel: string | null
		phaseAt: string | null
		createdAt: string | null
		updatedAt: string | null
		readyAt: string | null
		input: JsonValue
		output: JsonValue
		rejection: JsonValue
		error: JsonValue
		supersededBy: string | null
		supersededAt: string | null
	}
	runs: ArtifactRun[]
	modelCalls: ModelCall[]
	validations: ValidationResult[]
	statusHistory: StatusHistoryEvent[]
	lineage: {
		supersededBy: string | null
		supersededAt: string | null
		supersededArtifacts: Array<{
			id: string
			status: ArtifactStatus
			createdAt: string | null
			updatedAt: string | null
		}>
	}
	aiSdkTrace: {
		events: JsonValue[]
		source: string
		message: string
	}
}

export type BlocksResponse = {
	blocks: BlockSummary[]
	nextCursor: string | null
}

export type ResourcesResponse = {
	blockName: string
	resources: ResourceSummary[]
	nextCursor: string | null
}

export type ArtifactsResponse = {
	identity: {
		blockName: string
		blockVersion: string
		identityRef: string
		identityKey: string
	}
	artifacts: ArtifactVersion[]
	nextCursor: string | null
}

export type SearchResponse = {
	results: ArtifactVersion[]
	nextCursor: string | null
}

export type ListFilters = {
	q?: string
	searchField?: "all" | "blockName" | "artifactId" | "identityKey"
	status?: ArtifactStatus | "all"
	sortBy?: "latestUpdatedAt" | "identityKey" | "totalArtifacts"
	sortDirection?: "asc" | "desc"
}

export class ApiError extends Error {
	status: number

	constructor(status: number, message: string) {
		super(message)
		this.status = status
	}
}

const apiBaseUrl = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "")

export async function getBlocks(
	filters: ListFilters & { cursor?: string | null; limit?: number },
) {
	return getJson<BlocksResponse>("/thinking-block/blocks", filters)
}

export async function getResources(
	blockName: string,
	filters: ListFilters & { cursor?: string | null; limit?: number },
) {
	return getJson<ResourcesResponse>(
		`/thinking-block/blocks/${encodeURIComponent(blockName)}/resources`,
		filters,
	)
}

export async function getArtifacts(
	identityRef: string,
	cursor?: string | null,
) {
	return getJson<ArtifactsResponse>(
		`/thinking-block/resources/${encodeURIComponent(identityRef)}/artifacts`,
		{ cursor, limit: 50 },
	)
}

export async function getArtifactDetail(artifactId: string) {
	return getJson<ArtifactDetail>(
		`/thinking-block/artifacts/${encodeURIComponent(artifactId)}`,
	)
}

export async function searchArtifacts(
	filters: ListFilters & { cursor?: string | null; limit?: number },
) {
	return getJson<SearchResponse>("/thinking-block/search", filters)
}

async function getJson<T>(
	path: string,
	params: Record<string, string | number | null | undefined> = {},
): Promise<T> {
	const url = new URL(`${apiBaseUrl}${path}`, window.location.origin)
	for (const [key, value] of Object.entries(params)) {
		if (
			value === undefined ||
			value === null ||
			value === "" ||
			value === "all"
		) {
			continue
		}
		url.searchParams.set(key, String(value))
	}
	const res = await fetch(url, { credentials: "include" })
	if (!res.ok) {
		if (
			res.status === 404 &&
			typeof window !== "undefined" &&
			!window.location.pathname.startsWith("/login")
		) {
			const loginUrl = new URL("/login", window.location.origin)
			loginUrl.searchParams.set("redirect", window.location.href)
			window.location.assign(loginUrl)
		}
		let message = "Request failed"
		try {
			const body = (await res.json()) as { error?: string }
			message = body.error ?? message
		} catch {
			message = res.statusText || message
		}
		throw new ApiError(res.status, message)
	}
	return (await res.json()) as T
}
