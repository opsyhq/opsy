// Ported from rexxars/eventsource-parser (MIT, © 2025 Espen Hovlandsdal)
// https://github.com/rexxars/eventsource-parser
// Spec: https://html.spec.whatwg.org/multipage/server-sent-events.html

type ErrorType = "invalid-retry" | "unknown-field"

export interface EventSourceMessage {
	event?: string | undefined
	id?: string | undefined
	data: string
}

interface ParserCallbacks {
	onEvent?: ((event: EventSourceMessage) => void) | undefined
	onRetry?: ((retry: number) => void) | undefined
	onComment?: ((comment: string) => void) | undefined
	onError?: ((error: ParseError) => void) | undefined
}

interface EventSourceParser {
	feed(chunk: string): void
	reset(options?: { consume?: boolean }): void
}

class ParseError extends Error {
	type: ErrorType
	field?: string | undefined
	value?: string | undefined
	line?: string | undefined

	constructor(
		message: string,
		options: { type: ErrorType; field?: string; value?: string; line?: string },
	) {
		super(message)
		this.name = "ParseError"
		this.type = options.type
		this.field = options.field
		this.value = options.value
		this.line = options.line
	}
}

function noop(_arg: unknown): void {}

function createParser(callbacks: ParserCallbacks): EventSourceParser {
	if (typeof callbacks === "function") {
		throw new TypeError(
			"`callbacks` must be an object, got a function instead. Did you mean `{onEvent: fn}`?",
		)
	}

	const {
		onEvent = noop,
		onError = noop,
		onRetry = noop,
		onComment,
	} = callbacks

	let incompleteLine = ""

	let isFirstChunk = true
	let id: string | undefined
	let data = ""
	let eventType = ""

	function feed(newChunk: string): void {
		// Strip any UTF8 byte order mark (BOM) at the start of the stream.
		const chunk = isFirstChunk
			? newChunk.replace(/^\xEF\xBB\xBF/, "")
			: newChunk

		// If there was a previous incomplete line, append it to the new chunk
		// so we process it together as a new (hopefully complete) chunk.
		const [complete, incomplete] = splitLines(`${incompleteLine}${chunk}`)

		for (const line of complete) {
			parseLine(line)
		}

		incompleteLine = incomplete
		isFirstChunk = false
	}

	function parseLine(line: string): void {
		// Empty line → dispatch the pending event.
		if (line === "") {
			dispatchEvent()
			return
		}

		// Lines starting with U+003A COLON are comments.
		if (line.startsWith(":")) {
			if (onComment) {
				onComment(line.slice(line.startsWith(": ") ? 2 : 1))
			}
			return
		}

		// If the line contains a U+003A COLON, split on the first one.
		const fieldSeparatorIndex = line.indexOf(":")
		if (fieldSeparatorIndex !== -1) {
			const field = line.slice(0, fieldSeparatorIndex)
			// If the value starts with a single U+0020 SPACE, strip it (spec).
			const offset = line[fieldSeparatorIndex + 1] === " " ? 2 : 1
			const value = line.slice(fieldSeparatorIndex + offset)
			processField(field, value, line)
			return
		}

		// A colon-less non-empty line is a field name with an empty value —
		// per spec, a bare `data` line still appends a `\n` to the data buffer.
		processField(line, "", line)
	}

	function processField(field: string, value: string, line: string): void {
		// Field names compare literally — no case folding.
		switch (field) {
			case "event":
				eventType = value
				break
			case "data":
				// Append value + LF; the trailing LF is trimmed on dispatch.
				data = `${data}${value}\n`
				break
			case "id":
				// Ignore IDs that contain U+0000 NULL (spec).
				id = value.includes("\0") ? undefined : value
				break
			case "retry":
				if (/^\d+$/.test(value)) {
					onRetry(Number.parseInt(value, 10))
				} else {
					onError(
						new ParseError(`Invalid \`retry\` value: "${value}"`, {
							type: "invalid-retry",
							value,
							line,
						}),
					)
				}
				break
			default:
				// Unknown field — the spec says ignore. We surface it via onError
				// so a higher layer can log if it cares.
				onError(
					new ParseError(
						`Unknown field "${field.length > 20 ? `${field.slice(0, 20)}…` : field}"`,
						{ type: "unknown-field", field, value, line },
					),
				)
				break
		}
	}

	function dispatchEvent(): void {
		const shouldDispatch = data.length > 0
		if (shouldDispatch) {
			onEvent({
				id,
				event: eventType || undefined,
				// Trim the trailing LF from the data buffer (spec).
				data: data.endsWith("\n") ? data.slice(0, -1) : data,
			})
		}

		// Reset for the next event
		id = undefined
		data = ""
		eventType = ""
	}

	function reset(options: { consume?: boolean } = {}): void {
		if (incompleteLine && options.consume) {
			parseLine(incompleteLine)
		}

		isFirstChunk = true
		id = undefined
		data = ""
		eventType = ""
		incompleteLine = ""
	}

	return { feed, reset }
}

function splitLines(
	chunk: string,
): [complete: Array<string>, incomplete: string] {
	const lines: Array<string> = []
	let incomplete = ""
	let searchIndex = 0

	while (searchIndex < chunk.length) {
		const crIndex = chunk.indexOf("\r", searchIndex)
		const lfIndex = chunk.indexOf("\n", searchIndex)

		let lineEnd = -1
		if (crIndex !== -1 && lfIndex !== -1) {
			lineEnd = Math.min(crIndex, lfIndex)
		} else if (crIndex !== -1) {
			// CR at end of chunk may be the first half of a CRLF spanning
			// chunks — defer to the next feed call.
			if (crIndex === chunk.length - 1) {
				lineEnd = -1
			} else {
				lineEnd = crIndex
			}
		} else if (lfIndex !== -1) {
			lineEnd = lfIndex
		}

		if (lineEnd === -1) {
			incomplete = chunk.slice(searchIndex)
			break
		}

		const line = chunk.slice(searchIndex, lineEnd)
		lines.push(line)

		searchIndex = lineEnd + 1
		if (chunk[searchIndex - 1] === "\r" && chunk[searchIndex] === "\n") {
			searchIndex++
		}
	}

	return [lines, incomplete]
}

export async function* parseSseStream(
	stream: ReadableStream<Uint8Array>,
	signal?: AbortSignal,
): AsyncGenerator<EventSourceMessage> {
	const reader = stream.getReader()
	const decoder = new TextDecoder()
	const queue: EventSourceMessage[] = []
	const parser = createParser({
		onEvent: (event) => {
			queue.push(event)
		},
	})

	try {
		while (!signal?.aborted) {
			const { done, value } = await reader.read()
			if (done) break
			parser.feed(decoder.decode(value, { stream: true }))
			while (queue.length > 0) {
				const event = queue.shift()
				if (event) yield event
			}
		}
	} finally {
		reader.releaseLock()
	}
}
