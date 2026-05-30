import type { Field, ResourceTypeSchema } from "@opsy/provider"

// Strip `description` and `deprecationMessage` from a normalized schema tree
// (the `compact` HTTP format). Clones rather than mutates — the envelope the
// provider hands back is cached and shared, and a route must never scribble
// on it.

export function stripSchema(schema: ResourceTypeSchema): ResourceTypeSchema {
	const {
		description: _description,
		deprecationMessage: _deprecationMessage,
		...identity
	} = schema.identity
	return {
		version: schema.version,
		identity: { ...identity, fields: schema.identity.fields.map(stripField) },
	}
}

function stripField(field: Field): Field {
	const children = field.children.map(stripField)
	if (field.kind === "attribute") {
		const {
			description: _description,
			deprecationMessage: _deprecationMessage,
			...rest
		} = field
		return { ...rest, children }
	}
	const {
		description: _description,
		deprecationMessage: _deprecationMessage,
		...rest
	} = field
	return { ...rest, children }
}
