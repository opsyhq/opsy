import { defaultRetryPolicy, type RetryPolicy } from "./core/retry"
import {
	type BridgeClientState,
	type BridgeEffect,
	type BridgeEvent,
	createBridgeClientState,
	type RequestId,
	step,
} from "./core/state"
import { throwIfErrors } from "./diagnostics"
import { BridgeTransportError, coerceError, toAbortError } from "./errors"
import { HttpTransport, type HttpTransportOptions } from "./transport/http"
import type { Transport } from "./transport/types"
import type {
	DataSourceReadRequest,
	DataSourceReadResponse,
	ProviderConfigSchemaRequest,
	ProviderConfigSchemaResponse,
	ProviderMetadataRequest,
	ProviderMetadataResponse,
	ProviderSummaryRequest,
	ProviderSummaryResponse,
	ProviderTypeResolveRequest,
	ProviderTypeResolveResponse,
	ProviderTypeIdentityRequest,
	ProviderTypeIdentityResponse,
	ProviderTypeSchemaRequest,
	ProviderTypeSchemaResponse,
	ProviderTypesSearchRequest,
	ProviderTypesSearchResponse,
	ProviderValidateRequest,
	ResourceApplyRequest,
	ResourceApplyResponse,
	ResourceImportRequest,
	ResourceImportResponse,
	ResourcePlanRequest,
	ResourcePlanResponse,
	ResourceReadRequest,
	ResourceReadResponse,
	ResourceValidateRequest,
	ValidateResponse,
} from "./types"
import {
	type BridgeOp,
	type BridgeStreamEvent,
	BridgeStreamEventSchema,
	OP_TO_PATH,
	REQUEST_PAYLOAD_SCHEMAS,
	type RequestFor,
	type ResponseFor,
} from "./wire"

interface BridgeCallOptions {
	signal?: AbortSignal
	/** Per-call override of `deps.timeoutMs`. */
	timeoutMs?: number
	/** Per-call override of `deps.retry`. */
	retry?: RetryPolicy
}

interface BridgeCallEvent {
	method: "POST"
	path: string
	status: number | "error"
	durationMs: number
	error?: { name: string; message: string }
}

export interface BridgeClientOptions {
	onCall?: (event: BridgeCallEvent) => void
}

interface BridgeClientDeps extends BridgeClientOptions {
	transport: Transport
	/** Default per-call timeout in ms. `null` or omitted = no timeout. */
	timeoutMs?: number | null
	retry?: RetryPolicy
	clock?: { now: () => number }
	uuid?: () => string
}

interface CallOptions {
	throwOnDiagnostics?: boolean
	signal?: AbortSignal
	timeoutMs?: number | null
	retry?: RetryPolicy
}

interface PendingCaller {
	resolve: (res: unknown) => void
	reject: (err: Error) => void
	/** onCall observability event; closed out when the call settles. */
	event: BridgeCallEvent
	/** Gate for throwOnDiagnostics — applied after the deferred resolves. */
	throwOnDiagnostics: boolean
	startedAt: number
	cleanupSignal?: () => void
}

export class BridgeClient {
	private readonly deps: Required<
		Pick<BridgeClientDeps, "transport" | "retry" | "clock" | "uuid">
	> &
		BridgeClientOptions & { timeoutMs: number | null }
	/**
	 * The single source of truth for call lifecycle. All transitions go through
	 * `step()`. Exposed read-only via {@link getState} for tests/debugging.
	 */
	private state: BridgeClientState = createBridgeClientState()
	/**
	 * Imperative-shell registries — Promise resolvers and platform timer handles
	 * that cannot be serialized into pure `BridgeClientState`. They contain no
	 * business state; the reducer drives all decisions about when entries here
	 * are inserted or removed.
	 */
	private readonly pending = new Map<RequestId, PendingCaller>()
	private readonly timers = new Map<RequestId, ReturnType<typeof setTimeout>>()

	constructor(deps: BridgeClientDeps) {
		this.deps = {
			transport: deps.transport,
			onCall: deps.onCall,
			timeoutMs: deps.timeoutMs ?? null,
			retry: deps.retry ?? defaultRetryPolicy(),
			clock: deps.clock ?? { now: () => Date.now() },
			uuid: deps.uuid ?? defaultUuid,
		}
	}

	/**
	 * Convenience factory: constructs an `HttpTransport` targeting `baseUrl`
	 * and wraps it in a client. Primary migration path from the old
	 * positional-arg constructor.
	 */
	static fromUrl(
		baseUrl: string,
		opts: BridgeClientOptions &
			Pick<BridgeClientDeps, "retry" | "timeoutMs" | "clock" | "uuid"> & {
				transport?: HttpTransportOptions
			} = {},
	): BridgeClient {
		const { transport: transportOpts, ...rest } = opts
		return new BridgeClient({
			...rest,
			transport: new HttpTransport(baseUrl, transportOpts),
		})
	}

	/** Snapshot of inflight state. Intended for tests / debugging. */
	getState(): Readonly<BridgeClientState> {
		return this.state
	}

	private async call<Op extends BridgeOp>(
		op: Op,
		payload: unknown,
		options: CallOptions = {},
	): Promise<ResponseFor<Op>> {
		const throwOnDiagnostics = options.throwOnDiagnostics ?? true
		const validatedPayload = REQUEST_PAYLOAD_SCHEMAS[op].parse(payload)
		const req = { op, ...validatedPayload } as RequestFor<Op>
		const id = this.deps.uuid() as RequestId
		const timeoutMs = options.timeoutMs ?? this.deps.timeoutMs
		const retry = options.retry ?? this.deps.retry
		const startedAt = this.deps.clock.now()
		const event = makeCallEvent(op)

		return await new Promise<ResponseFor<Op>>((resolve, reject) => {
			const pending: PendingCaller = {
				resolve: (res) => resolve(res as ResponseFor<Op>),
				reject,
				event,
				throwOnDiagnostics,
				startedAt,
			}

			if (options.signal) {
				if (options.signal.aborted) {
					this.settleReject(id, pending, toAbortError(options.signal.reason))
					return
				}
				const onAbort = () => {
					this.dispatch(
						{
							type: "Canceled",
							id,
							reason: toAbortError(options.signal?.reason),
						},
						retry,
					)
				}
				options.signal.addEventListener("abort", onAbort, { once: true })
				pending.cleanupSignal = () =>
					options.signal?.removeEventListener("abort", onAbort)
			}

			this.pending.set(id, pending)
			this.dispatch(
				{ type: "Send", id, req, now: startedAt, timeoutMs: timeoutMs ?? null },
				retry,
			)
		})
	}

	private dispatch(event: BridgeEvent, retry: RetryPolicy): void {
		const { next, effects } = step(this.state, event, retry)
		this.state = next
		for (const effect of effects) this.runEffect(effect, retry)
	}

	private runEffect(effect: BridgeEffect, retry: RetryPolicy): void {
		switch (effect.kind) {
			case "SendOnWire": {
				this.deps.transport
					.unary(effect.req, { timeoutMs: effect.timeoutMs ?? undefined })
					.then((res) =>
						this.dispatch(
							{ type: "Delivered", id: effect.id, response: res },
							retry,
						),
					)
					.catch((err: unknown) => {
						this.dispatch(
							{
								type: "Errored",
								id: effect.id,
								error: coerceError(err),
								now: this.deps.clock.now(),
							},
							retry,
						)
					})
				return
			}
			case "ResolveCaller": {
				const pending = this.pending.get(effect.id)
				if (!pending) return
				this.fireOnCall(pending.event, pending.startedAt, 200)
				pending.cleanupSignal?.()
				this.pending.delete(effect.id)
				try {
					if (pending.throwOnDiagnostics)
						throwIfErrors(
							(effect.response as { diagnostics?: unknown[] })
								.diagnostics as never,
						)
				} catch (err) {
					const e = err as Error
					pending.event.error = { name: e.name, message: e.message }
					pending.reject(e)
					return
				}
				pending.resolve(effect.response)
				return
			}
			case "RejectCaller": {
				const pending = this.pending.get(effect.id)
				if (!pending) return
				this.fireOnCall(
					pending.event,
					pending.startedAt,
					effect.error instanceof BridgeTransportError
						? effect.error.status
						: "error",
					effect.error,
				)
				pending.cleanupSignal?.()
				this.pending.delete(effect.id)
				pending.reject(effect.error)
				return
			}
			case "ScheduleRetry": {
				const timer = setTimeout(() => {
					this.timers.delete(effect.id)
					this.dispatch(
						{ type: "RetryDue", id: effect.id, now: this.deps.clock.now() },
						retry,
					)
				}, effect.delayMs)
				this.timers.set(effect.id, timer)
				return
			}
			case "ArmTimeout": {
				const timer = setTimeout(() => {
					this.timers.delete(effect.id)
					this.dispatch(
						{ type: "TimedOut", id: effect.id, now: this.deps.clock.now() },
						retry,
					)
				}, effect.delayMs)
				this.timers.set(effect.id, timer)
				return
			}
			case "ClearTimer": {
				const t = this.timers.get(effect.id)
				if (t) {
					clearTimeout(t)
					this.timers.delete(effect.id)
				}
				return
			}
		}
	}

	private async *stream<Op extends BridgeOp>(
		op: Op,
		payload: unknown,
		options: BridgeCallOptions,
	): AsyncIterable<BridgeStreamEvent> {
		const validatedPayload = REQUEST_PAYLOAD_SCHEMAS[op].parse(payload)
		const req = { op, ...validatedPayload } as RequestFor<Op>
		const id = this.deps.uuid() as RequestId
		const startedAt = this.deps.clock.now()
		const event = makeCallEvent(op)
		const retry = options.retry ?? this.deps.retry
		const timeoutMs = options.timeoutMs ?? this.deps.timeoutMs

		this.dispatch({ type: "StreamStart", id, req, now: startedAt }, retry)

		let sawFinal = false
		let finalResponse: ResponseFor<Op> | undefined
		try {
			const iter = this.deps.transport.stream(req, {
				timeoutMs: timeoutMs ?? undefined,
				signal: options.signal,
			})
			for await (const raw of iter) {
				const ev = BridgeStreamEventSchema.parse(raw) as BridgeStreamEvent
				if (ev.kind === "final") {
					sawFinal = true
					finalResponse = ev.response as ResponseFor<Op>
				}
				yield ev
			}
			if (!sawFinal)
				throw new Error("bridge stream ended without a 'final' event")
			throwIfErrors(
				(finalResponse as { diagnostics?: unknown[] }).diagnostics as never,
			)
			this.dispatch({ type: "StreamEnd", id }, retry)
			this.fireOnCall(event, startedAt, 200)
		} catch (err) {
			const error = coerceError(err)
			this.dispatch({ type: "StreamFailed", id, error }, retry)
			this.fireOnCall(event, startedAt, "error", error)
			throw error
		}
	}

	private settleReject(
		id: RequestId,
		pending: PendingCaller,
		err: Error,
	): void {
		this.fireOnCall(pending.event, pending.startedAt, "error", err)
		pending.cleanupSignal?.()
		this.pending.delete(id)
		pending.reject(err)
	}

	private fireOnCall(
		event: BridgeCallEvent,
		startedAt: number,
		status: number | "error",
		err?: Error,
	): void {
		event.status = status
		event.durationMs = this.deps.clock.now() - startedAt
		if (err) event.error = { name: err.name, message: err.message }
		if (!this.deps.onCall) return
		try {
			this.deps.onCall(event)
		} catch (cbErr) {
			process.stderr.write(
				`bridge-client onCall threw: ${(cbErr as Error).message}\n`,
			)
		}
	}

	// validate-* methods skip the throw — diagnostics are the payload
	validateProvider(
		req: ProviderValidateRequest,
		options: BridgeCallOptions = {},
	): Promise<ValidateResponse> {
		return this.call("provider.validate", req, {
			throwOnDiagnostics: false,
			...options,
		})
	}
	validateResource(
		req: ResourceValidateRequest,
		options: BridgeCallOptions = {},
	): Promise<ValidateResponse> {
		return this.call("resource.validate", req, {
			throwOnDiagnostics: false,
			...options,
		})
	}

	// Everything else throws on error diagnostics
	getMetadata(
		req: ProviderMetadataRequest,
		options: BridgeCallOptions = {},
	): Promise<ProviderMetadataResponse> {
		return this.call("provider.metadata", req, options)
	}
	getSummary(
		req: ProviderSummaryRequest,
		options: BridgeCallOptions = {},
	): Promise<ProviderSummaryResponse> {
		return this.call("provider.summary", req, options)
	}
	searchTypes(
		req: ProviderTypesSearchRequest,
		options: BridgeCallOptions = {},
	): Promise<ProviderTypesSearchResponse> {
		return this.call("provider.types.search", req, options)
	}
	resolveType(
		req: ProviderTypeResolveRequest,
		options: BridgeCallOptions = {},
	): Promise<ProviderTypeResolveResponse> {
		return this.call("provider.types.resolve", req, options)
	}
	getTypeSchema(
		req: ProviderTypeSchemaRequest,
		options: BridgeCallOptions = {},
	): Promise<ProviderTypeSchemaResponse> {
		return this.call("provider.types.schema", req, options)
	}
	getTypeIdentity(
		req: ProviderTypeIdentityRequest,
		options: BridgeCallOptions = {},
	): Promise<ProviderTypeIdentityResponse> {
		return this.call("provider.types.identity", req, options)
	}
	getProviderConfigSchema(
		req: ProviderConfigSchemaRequest,
		options: BridgeCallOptions = {},
	): Promise<ProviderConfigSchemaResponse> {
		return this.call("provider.config-schema", req, options)
	}
	readResource(
		req: ResourceReadRequest,
		options: BridgeCallOptions = {},
	): Promise<ResourceReadResponse> {
		return this.call("resource.read", req, options)
	}
	planResource(
		req: ResourcePlanRequest,
		options: BridgeCallOptions = {},
	): Promise<ResourcePlanResponse> {
		return this.call("resource.plan", req, options)
	}
	applyResource(
		req: ResourceApplyRequest,
		options: BridgeCallOptions = {},
	): Promise<ResourceApplyResponse> {
		return this.call("resource.apply", req, options)
	}
	/**
	 * Streaming variant of `applyResource`. Yields validated `BridgeStreamEvent`s
	 * (`progress`, `diagnostic`, `final`). The stream MUST end with a `final`
	 * event whose `response.diagnostics` are checked against `throwOnDiagnostics`.
	 *
	 * Today most transports synthesize a single `final` event from a unary call;
	 * once the bridge grows real SSE/chunked support, the same surface delivers
	 * progress events without consumer changes.
	 */
	applyStream(
		req: ResourceApplyRequest,
		options: BridgeCallOptions = {},
	): AsyncIterable<BridgeStreamEvent> {
		return this.stream("resource.apply", req, options)
	}
	importResource(
		req: ResourceImportRequest,
		options: BridgeCallOptions = {},
	): Promise<ResourceImportResponse> {
		return this.call("resource.import", req, options)
	}
	readDataSource(
		req: DataSourceReadRequest,
		options: BridgeCallOptions = {},
	): Promise<DataSourceReadResponse> {
		return this.call("datasource.read", req, options)
	}
}

function defaultUuid(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto)
		return crypto.randomUUID()
	return `r_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

function makeCallEvent(op: BridgeOp): BridgeCallEvent {
	return { method: "POST", path: OP_TO_PATH[op], status: 0, durationMs: 0 }
}
