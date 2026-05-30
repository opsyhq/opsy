import { setAtPath, valueAtPath } from "@/lib/path"
import { referenceValueForSelection } from "@/lib/resourceRefs"

export type RelatedCreateTargetEndpoint = {
	type: string
	path: string
}

export type RelatedCreateFieldRequest = {
	fieldPath: string
	targetEndpoint: RelatedCreateTargetEndpoint
	cardinality: "one" | "many"
	values: Record<string, unknown>
}

export type RelatedCreateSource =
	| {
			kind: "live"
			resourceSlug: string
			fieldPath: string
			cardinality: "one" | "many"
			values: Record<string, unknown>
	  }
	| {
			kind: "staged"
			stagedItemId: string
			fieldPath: string
			cardinality: "one" | "many"
			changes: { inputs?: Record<string, unknown> } & Record<string, unknown>
			returnMode: "create" | "detail"
	  }

export function writeRelatedReference(input: {
	values: Record<string, unknown>
	fieldPath: string
	ref: string
	cardinality: "one" | "many"
}): Record<string, unknown> {
	const currentValue = Object.hasOwn(input.values, input.fieldPath)
		? input.values[input.fieldPath]
		: valueAtPath(input.values, input.fieldPath)
	return setAtPath(
		input.values,
		input.fieldPath,
		referenceValueForSelection({
			value: currentValue,
			ref: input.ref,
			cardinality: input.cardinality,
			selected: true,
		}),
	)
}
