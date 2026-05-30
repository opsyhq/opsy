import { shutdownDb } from "../src/lib/db/client"
import { migrate } from "../src/lib/db/migrate"
import type { CapabilitySourceKind } from "../src/lib/db/schema"
import { shutdownProviders } from "../src/lib/providers"
import {
	providerRefFromProviderName,
	providerRuntime,
} from "../src/provider-runtime"
import {
	type RelationshipRulesBlockInput,
	relationshipRulesBlock,
} from "../src/resources/artifacts/relationship-rules"
import { thinkingBlockInputHash } from "../src/thinking-blocks"

type Args = {
	provider: string
	kind: CapabilitySourceKind
	types: string[]
	concurrency: number
	maxAttempts?: number
}

function readArgs(argv: string[]): Args {
	const args: Args = {
		provider: "aws",
		kind: "resource",
		types: [],
		concurrency: 10,
	}
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i]
		const next = () => {
			const value = argv[i + 1]
			if (!value || value.startsWith("--")) throw new Error("missing value")
			i += 1
			return value
		}
		switch (arg) {
			case "--provider":
				args.provider = next()
				break
			case "--kind": {
				const value = next()
				if (value !== "resource" && value !== "data") {
					throw new Error("--kind must be resource or data")
				}
				args.kind = value
				break
			}
			case "--type":
				args.types.push(next())
				break
			case "--attempts": {
				const value = Number.parseInt(next(), 10)
				if (!Number.isInteger(value) || value < 1 || value > 10) {
					throw new Error("--attempts must be between 1 and 10")
				}
				args.maxAttempts = value
				break
			}
			case "--concurrency": {
				const value = Number.parseInt(next(), 10)
				if (!Number.isInteger(value) || value < 1 || value > 100) {
					throw new Error("--concurrency must be between 1 and 100")
				}
				args.concurrency = value
				break
			}
			default:
				throw new Error(`unknown arg: ${arg}`)
		}
	}
	if (args.types.length === 0) {
		throw new Error("pass at least one --type")
	}
	return args
}

async function main() {
	const args = readArgs(Bun.argv.slice(2))
	await migrate()
	try {
		const ref = providerRefFromProviderName(args.provider)
		const provider = await providerRuntime.require(ref)
		const results = new Array(args.types.length)
		let nextTypeIndex = 0
		const regenerateNextType = async () => {
			for (;;) {
				const resultIndex = nextTypeIndex
				if (resultIndex >= args.types.length) return
				nextTypeIndex += 1
				const type = args.types[resultIndex]
				const schema = await provider.getSchema(type, args.kind)
				if (!schema) {
					results[resultIndex] = {
						provider: args.provider,
						kind: args.kind,
						type,
						status: "no_schema",
					}
					continue
				}
				const input = {
					ref,
					kind: args.kind,
					type,
					schema,
					schemaHash: thinkingBlockInputHash(schema.identity),
				} satisfies RelationshipRulesBlockInput
				const result = await relationshipRulesBlock.generate(input, {
					trigger: "manual_relationship_rule_regeneration",
					...(args.maxAttempts ? { maxAttempts: args.maxAttempts } : {}),
				})
				results[resultIndex] = result.ok
					? {
							provider: args.provider,
							kind: args.kind,
							type,
							status: "ready",
							artifactId: result.artifactId,
							rules: result.output.rules.length,
						}
					: {
							provider: args.provider,
							kind: args.kind,
							type,
							status: "rejected",
							artifactId: result.artifactId,
							reason: result.reason,
							details: result.details,
						}
			}
		}
		await Promise.all(
			Array.from(
				{ length: Math.min(args.concurrency, args.types.length) },
				() => regenerateNextType(),
			),
		)
		console.log(JSON.stringify({ results }, null, 2))
	} finally {
		relationshipRulesBlock.stop()
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
