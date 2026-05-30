export type CapabilitySourceKind = "resource" | "data"
export const capabilitySourceKindValues = ["resource", "data"] as const
export const resourceRoleValues = [
	"ATTACHMENT",
	"REFERENCE",
	"SCOPE",
	"ASSOCIATION",
] as const
export const resourceRelationshipCardinalityValues = ["one", "many"] as const

export type ResourceRole = (typeof resourceRoleValues)[number]
export type ResourceRelationshipCardinality =
	(typeof resourceRelationshipCardinalityValues)[number]
