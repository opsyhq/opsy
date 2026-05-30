import { OperationSection } from "@/components/operations/OperationSection"

type Row = { key: string; value: unknown }

function KeyValueTable({ rows }: { rows: Row[] }) {
	if (rows.length === 0) return null
	return (
		<div className="grid gap-1.5 p-3">
			{rows.map(({ key, value }) => (
				<div
					key={key}
					className="grid grid-cols-[8rem_1fr] items-start gap-6 text-xs"
				>
					<span className="min-w-0 font-mono text-muted-foreground">{key}</span>
					<span className="min-w-0">
						<ValueCell value={value} />
					</span>
				</div>
			))}
		</div>
	)
}

function ValueCell({ value }: { value: unknown }) {
	if (value === null || value === undefined) {
		return <span className="italic text-muted-foreground">—</span>
	}
	if (typeof value === "string") {
		return <span className="font-mono break-all">{value}</span>
	}
	if (typeof value === "number") {
		return <span className="font-mono">{value}</span>
	}
	if (typeof value === "boolean") {
		return <span className="font-mono">{value ? "true" : "false"}</span>
	}
	return (
		<pre className="scrollbar-thin overflow-auto font-mono text-xs whitespace-pre-wrap break-all">
			{JSON.stringify(value, null, 2)}
		</pre>
	)
}

function objectToRows(
	obj: Record<string, unknown>,
	exclude: string[] = [],
): Row[] {
	return Object.entries(obj)
		.filter(([k]) => !exclude.includes(k))
		.map(([key, value]) => ({ key, value }))
}

function requestBody(request: unknown): React.ReactElement | null {
	if (!request || typeof request !== "object") return null
	const obj = request as Record<string, unknown>
	const kind = obj.kind as string | undefined

	switch (kind) {
		case "create":
		case "update": {
			const inputs =
				obj.inputs && typeof obj.inputs === "object"
					? (obj.inputs as Record<string, unknown>)
					: null
			if (!inputs) return null
			return <KeyValueTable rows={objectToRows(inputs)} />
		}
		case "delete":
		case "forget":
			// Nothing meaningful — kind badge + resource slug already say everything.
			return null
		case "import":
		case "track": {
			const rows = objectToRows(obj, ["kind"])
			if (rows.length === 0) return null
			return <KeyValueTable rows={rows} />
		}
		default: {
			const rows = objectToRows(obj, ["kind"])
			if (rows.length === 0) return null
			return <KeyValueTable rows={rows} />
		}
	}
}

export function OperationRequestView({ request }: { request: unknown }) {
	const body = requestBody(request)
	if (!body) return null
	return <OperationSection title="Request">{body}</OperationSection>
}
