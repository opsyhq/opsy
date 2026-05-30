import { and, eq, isNull } from "drizzle-orm"
import { db, shutdownDb } from "../src/lib/db/client"
import { migrate } from "../src/lib/db/migrate"
import { projects, resources } from "../src/lib/db/schema"
import { shutdownProviders } from "../src/lib/providers"
import {
	providerRefFromProviderName,
	providerRuntime,
} from "../src/provider-runtime"
import { resourceTypeDisplayMetadataBlock } from "../src/resources/artifacts/metadata"
import { thinkingBlockInputHash } from "../src/thinking-blocks"

type Args = {
	project: string
	type: string | null
}

type TypeSummary = {
	provider: string
	type: string
	status: "ready" | "no_schema"
	schemaHash: string | null
	name: string | null
	display: string | null
	artifactId: string | null
}

function readArgs(argv: string[]): Args {
	const args: Args = { project: "opsy", type: null }
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i]
		const next = () => {
			const value = argv[i + 1]
			if (!value || value.startsWith("--")) throw new Error("missing value")
			i += 1
			return value
		}
		switch (arg) {
			case "--project":
				args.project = next()
				break
			case "--type":
				args.type = next()
				break
			default:
				throw new Error(`unknown arg: ${arg}`)
		}
	}
	return args
}

function applyTypeFilter(
	providerTypes: Map<string, Set<string>>,
	type: string | null,
): void {
	if (!type) return
	let found = false
	for (const [providerName, types] of providerTypes) {
		for (const providerType of [...types]) {
			if (providerType === type) {
				found = true
			} else {
				types.delete(providerType)
			}
		}
		if (types.size === 0) providerTypes.delete(providerName)
	}
	if (!found) throw new Error(`resource type not currently in use: ${type}`)
}

async function main() {
	const args = readArgs(Bun.argv.slice(2))
	await migrate()
	try {
		const [project] = await db
			.select({ id: projects.id, slug: projects.slug })
			.from(projects)
			.where(and(eq(projects.slug, args.project), isNull(projects.deletedAt)))
			.limit(1)
		if (!project) throw new Error(`project not found: ${args.project}`)

		const currentResources = await db
			.select()
			.from(resources)
			.where(
				and(eq(resources.projectId, project.id), isNull(resources.deletedAt)),
			)
		const providerTypes = new Map<string, Set<string>>()
		for (const resource of currentResources) {
			if (!resource.provider) continue
			const types = providerTypes.get(resource.provider) ?? new Set<string>()
			types.add(resource.type)
			providerTypes.set(resource.provider, types)
		}
		applyTypeFilter(providerTypes, args.type)

		const summaries: TypeSummary[] = []
		for (const [providerName, types] of providerTypes) {
			const ref = providerRefFromProviderName(providerName)
			const provider = await providerRuntime.require(ref)
			for (const type of [...types].sort()) {
				const schema = await provider.getSchema(type, "resource")
				if (!schema) {
					summaries.push({
						provider: providerName,
						type,
						status: "no_schema",
						schemaHash: null,
						name: null,
						display: null,
						artifactId: null,
					})
					continue
				}
				const hash = thinkingBlockInputHash(schema.identity)
				const result = await resourceTypeDisplayMetadataBlock.generate({
					provider: providerName,
					providerVersion: ref.version,
					kind: "resource",
					type,
					schema,
					schemaHash: hash,
				})
				summaries.push({
					provider: providerName,
					type,
					status: "ready",
					schemaHash: hash,
					name: result.ok ? result.output.name : null,
					display: result.ok ? result.output.display : null,
					artifactId: result.ok ? result.artifactId : null,
				})
			}
		}

		console.log(
			JSON.stringify(
				{
					project,
					types: summaries,
				},
				null,
				2,
			),
		)
	} finally {
		resourceTypeDisplayMetadataBlock.stop()
		await shutdownProviders()
	}
}

async function run() {
	try {
		await main()
	} catch (err) {
		console.error(err)
		process.exitCode = 1
	} finally {
		await shutdownDb()
	}
}

void run()
