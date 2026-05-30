import type { Field, ResourceTypeSchema, State } from "@opsy/provider"
import type { Resource } from "../lib/db/schema"
import { jsonValueEqual } from "../lib/json"

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}

function fieldIsSettable(field: Field): boolean {
	return field.kind === "block" || field.required || field.optional
}

function getCollectionKind(
	field: Extract<Field, { kind: "attribute" }>,
): string | null {
	return Array.isArray(field.type) ? field.type[0] : null
}

export function getInputsBySchemaFields(
	fields: Field[],
	state: unknown,
): Record<string, unknown> {
	if (!isRecord(state)) return {}
	const inputs: Record<string, unknown> = {}
	for (const field of fields) {
		const name = field.name.terraformName
		const value = getInputValueBySchemaField(field, state[name])
		if (value !== undefined) inputs[name] = value
	}
	return inputs
}

function getInputValueBySchemaField(field: Field, value: unknown): unknown {
	if (value === undefined || !fieldIsSettable(field)) return undefined
	if (field.kind === "block") return getBlockInputValue(field, value)
	if (field.children.length === 0) return value

	const kind = getCollectionKind(field)
	if (kind === "list" || kind === "set") {
		return Array.isArray(value)
			? value.map((item) => getInputsBySchemaFields(field.children, item))
			: value
	}
	if (kind === "map") {
		return isRecord(value)
			? Object.fromEntries(
					Object.entries(value).map(([key, item]) => [
						key,
						getInputsBySchemaFields(field.children, item),
					]),
				)
			: value
	}
	return getObjectAttributeInputValue(field, value)
}

function getObjectAttributeInputValue(
	field: Extract<Field, { kind: "attribute" }>,
	value: unknown,
): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => getInputsBySchemaFields(field.children, item))
	}
	return isRecord(value)
		? getInputsBySchemaFields(field.children, value)
		: value
}

function getBlockInputValue(
	field: Extract<Field, { kind: "block" }>,
	value: unknown,
): unknown {
	if (field.nestingMode === "list" || field.nestingMode === "set") {
		return Array.isArray(value)
			? value.map((item) => getInputsBySchemaFields(field.children, item))
			: undefined
	}
	if (field.nestingMode === "map") {
		if (!isRecord(value)) return undefined
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				getInputsBySchemaFields(field.children, item),
			]),
		)
	}
	return isRecord(value)
		? getInputsBySchemaFields(field.children, value)
		: undefined
}

function getDeclaredInputsFromReadState(
	fields: Field[],
	inputs: Record<string, unknown>,
	readState: unknown,
): Record<string, unknown> {
	if (!isRecord(readState)) return inputs
	const next: Record<string, unknown> = {}
	for (const field of fields) {
		const name = field.name.terraformName
		if (!Object.hasOwn(inputs, name)) continue
		const value = getInputValueBySchemaField(field, readState[name])
		if (value !== undefined) {
			next[name] = value
		} else if (fieldIsSettable(field)) {
			next[name] = inputs[name]
		}
	}
	return next
}

export function getReadStateForInputShape(
	inputs: Record<string, unknown>,
	readState: unknown,
): Record<string, unknown>
export function getReadStateForInputShape(
	inputs: unknown,
	readState: unknown,
): unknown
export function getReadStateForInputShape(
	inputs: unknown,
	readState: unknown,
): unknown {
	if (readState === undefined) return inputs
	if (Array.isArray(inputs)) {
		if (!Array.isArray(readState)) return inputs
		const template = inputs[0]
		return template === undefined
			? inputs
			: readState.map((item) => getReadStateForInputShape(template, item))
	}
	if (isRecord(inputs)) {
		if (!isRecord(readState)) {
			return inputs
		}
		const values = new Map(Object.entries(readState))
		return Object.fromEntries(
			Object.entries(inputs).map(([key, value]) => [
				key,
				getReadStateForInputShape(value, values.get(key)),
			]),
		)
	}
	return readState
}

type ResourceStatePatch =
	| { status: "missing" }
	| {
			inputs: Record<string, unknown>
			outputs: Record<string, unknown>
			status: "live"
	  }

export function getResourceStatePatchAfterRead(
	resource: Pick<Resource, "inputs" | "outputs" | "status">,
	readState: State | null,
	schema: ResourceTypeSchema | null,
): ResourceStatePatch | null {
	if (readState === null)
		return resource.status === "missing" ? null : { status: "missing" }

	const inputs = resource.inputs
		? schema
			? getDeclaredInputsFromReadState(
					schema.identity.fields,
					resource.inputs,
					readState,
				)
			: getReadStateForInputShape(resource.inputs, readState)
		: schema
			? getInputsBySchemaFields(schema.identity.fields, readState)
			: getReadStateForInputShape({}, readState)
	if (
		resource.status === "live" &&
		jsonValueEqual(inputs, resource.inputs) &&
		jsonValueEqual(readState, resource.outputs)
	) {
		return null
	}

	return { inputs, outputs: readState, status: "live" }
}
