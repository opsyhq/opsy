import {
	Activity,
	Bell,
	Box,
	Boxes,
	Clock,
	Component,
	Copy,
	Database,
	Fingerprint,
	Gauge,
	Globe,
	Hexagon,
	Info,
	KeyRound,
	Layers,
	Link2,
	Lock,
	Network,
	Server,
	ShieldCheck,
	Tag,
} from "lucide-react"
import type { ComponentType } from "react"
import type { ResolvedTypeView } from "@/components/resource-detail/resolvedTypeView"
import type { FieldLayoutSection } from "@/components/resource-fields/fieldLayout"
import { resolveFieldLayout } from "@/components/resource-fields/fieldLayout"
import { isRecord } from "@/lib/changeDiff"
import type { ChangeSetItem } from "@/lib/changeSetReactQuery"
import type { ProjectResource } from "@/lib/projectReactQuery"

export type DraftResource = {
	itemId: string
	operation: "create" | "import"
	slug: string
	provider: string | null
	type: string
	inputs: Record<string, unknown>
	changes: Record<string, unknown>
}

export type ResourceDetailSubject =
	| { kind: "existing"; resource: ProjectResource }
	| { kind: "draft"; resource: DraftResource }

export type ResourceDetailSectionTab = {
	value: string
	section: FieldLayoutSection
}

export function toDraftResource(item: ChangeSetItem): DraftResource {
	const changes =
		item.changes && typeof item.changes === "object"
			? (item.changes as Record<string, unknown>)
			: {}
	const type = typeof changes.type === "string" ? changes.type : ""
	const provider = type.includes("_") ? type.slice(0, type.indexOf("_")) : null
	const slug =
		typeof changes.slug === "string" && changes.slug.length > 0
			? changes.slug
			: item.id
	const inputs =
		changes.inputs && typeof changes.inputs === "object"
			? (changes.inputs as Record<string, unknown>)
			: {}

	return {
		itemId: item.id,
		operation: item.kind === "import_resource" ? "import" : "create",
		slug,
		provider,
		type,
		inputs,
		changes,
	}
}

export function buildDraftSubmitChanges(
	draft: DraftResource,
	values: Record<string, unknown>,
): Record<string, unknown> {
	return { ...draft.changes, inputs: values }
}

export function getResourceDetailSections(
	view: ResolvedTypeView | undefined,
): ResourceDetailSectionTab[] {
	const layout = view
		? resolveFieldLayout(view, view.artifacts?.fieldLayout.data ?? null)
		: null
	return (layout?.sections ?? []).map((section) => ({
		value: `section:${section.title}`,
		section,
	}))
}

// Read-only/computed fields seed from this. For existing resources it's the
// live provider state (pre-apply `outputs` is null so the merge resolves to
// `inputs`; post-apply `outputs` wins). For drafts it's the dry-run's
// plannedState — the bridge's resolved view, so computed fields (region,
// arn, …) populate before apply. Editable inputs never read from here.
export function computeDisplayValues(
	subject: ResourceDetailSubject | null,
	draftPlannedState: unknown,
): Record<string, unknown> | undefined {
	if (subject?.kind === "draft") {
		return isRecord(draftPlannedState) ? draftPlannedState : undefined
	}
	if (subject?.kind === "existing") {
		return {
			...(subject.resource.inputs ?? {}),
			...(subject.resource.outputs ?? {}),
		}
	}
	return undefined
}

// Edit-mode seed: the resolved state (existing → inputs ∪ live outputs; draft →
// dry-run plannedState) overlaid by declared inputs, so resolved values like
// region surface in the form. Submit persists only edited fields (RHF dirty),
// so these baselines aren't baked into the staged inputs.
export function computeEditSeed(
	displayValues: Record<string, unknown> | undefined,
	resourceValues: Record<string, unknown>,
): Record<string, unknown> {
	return isRecord(displayValues)
		? { ...displayValues, ...resourceValues }
		: resourceValues
}

const SECTION_ICON_RULES: ReadonlyArray<
	readonly [readonly string[], ComponentType<{ className?: string }>]
> = [
	[["detail", "general", "overview", "summary", "basic", "core"], Info],
	[
		["access", "ownership", "owner", "permission", "iam", "principal"],
		KeyRound,
	],
	[["policy", "role", "grant", "auth"], ShieldCheck],
	[["encrypt", "kms", "secret", "credential"], Lock],
	[["replicat", "backup", "snapshot", "disaster", "failover", "sync"], Copy],
	[["data", "storage", "object", "lifecycle", "content", "bucket"], Database],
	[["website", "hosting", "static", "page", "web"], Globe],
	[["cors", "domain", "dns", "url", "route", "path", "endpoint"], Link2],
	[["network", "vpc", "subnet", "firewall", "ingress", "egress"], Network],
	[["monitor", "log", "metric", "observ", "audit", "trace", "alarm"], Activity],
	[["notification", "event", "alert", "trigger", "hook"], Bell],
	[["tag", "label", "metadata", "annotation"], Tag],
	[["compute", "instance", "server", "node", "runtime", "container"], Server],
	[["scal", "capacity", "throughput", "performance", "size"], Gauge],
	[["schedule", "timeout", "ttl", "expir", "retention", "time"], Clock],
	[["identifier", "arn", "address", "uri", "fingerprint"], Fingerprint],
	[["security", "secure", "protect", "shield", "compliance"], ShieldCheck],
]

const SECTION_ICON_FALLBACK: ReadonlyArray<
	ComponentType<{ className?: string }>
> = [Box, Layers, Boxes, Component, Hexagon]

export function sectionTabIcon(
	title: string,
): ComponentType<{ className?: string }> {
	const haystack = title.toLowerCase()
	let best: {
		icon: ComponentType<{ className?: string }>
		index: number
	} | null = null
	for (const [keywords, icon] of SECTION_ICON_RULES) {
		for (const keyword of keywords) {
			const index = haystack.indexOf(keyword)
			if (index === -1) continue
			if (!best || index < best.index) best = { icon, index }
			break
		}
	}
	if (best) return best.icon
	let hash = 0
	for (let i = 0; i < title.length; i++) {
		hash = (hash * 31 + title.charCodeAt(i)) | 0
	}
	return SECTION_ICON_FALLBACK[Math.abs(hash) % SECTION_ICON_FALLBACK.length]
}
