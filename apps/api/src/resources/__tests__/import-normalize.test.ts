import { describe, expect, test } from "bun:test"
import {
	buildFieldTree,
	type ResourceSchema,
	type ResourceTypeSchema,
} from "@opsy/provider"
import { getInputsBySchemaFields } from "../state"

// Test-local shape adapter for the import-projection fixture style. Production
// inlines `getInputsBySchemaFields(schema.identity.fields, state)` directly at
// the import step (steps.ts).
function getInputsFromImportedState(arg: {
	schema: ResourceTypeSchema
	state: unknown
}): Record<string, unknown> {
	return getInputsBySchemaFields(arg.schema.identity.fields, arg.state)
}

describe("getInputsFromImportedState — aws_vpc-shaped fixture", () => {
	const schema: ResourceSchema = {
		version: 1,
		block: {
			attributes: {
				cidr_block: { required: true },
				enable_dns_hostnames: { optional: true, computed: true },
				id: { computed: true },
				arn: { computed: true },
				tags_all: { computed: true },
			},
		},
	}

	const state = {
		cidr_block: "10.0.0.0/16",
		enable_dns_hostnames: true,
		id: "vpc-abc123",
		arn: "arn:aws:ec2:us-east-1:123456789012:vpc/vpc-abc123",
		tags_all: {},
	}

	test("includes required and optional+computed attrs; drops computed-only attrs", () => {
		const result = getInputsFromImportedState({
			schema: buildFieldTree(schema),
			state,
		})
		expect(result).toHaveProperty("cidr_block", "10.0.0.0/16")
		expect(result).toHaveProperty("enable_dns_hostnames", true)
		expect(result).not.toHaveProperty("id")
		expect(result).not.toHaveProperty("arn")
		expect(result).not.toHaveProperty("tags_all")
	})
})

describe("getInputsFromImportedState — aws_s3_bucket-shaped fixture", () => {
	const schema: ResourceSchema = {
		version: 1,
		block: {
			attributes: {
				bucket: { required: true },
				bucket_domain_name: { computed: true },
				hosted_zone_id: { computed: true },
			},
		},
	}

	const state = {
		bucket: "my-bucket",
		bucket_domain_name: "my-bucket.s3.amazonaws.com",
		hosted_zone_id: "Z3AQBSTGFYJSTF",
	}

	test("preserves required bucket; drops computed-only fields", () => {
		const result = getInputsFromImportedState({
			schema: buildFieldTree(schema),
			state,
		})
		expect(result).toHaveProperty("bucket", "my-bucket")
		expect(result).not.toHaveProperty("bucket_domain_name")
		expect(result).not.toHaveProperty("hosted_zone_id")
	})
})

describe("getInputsFromImportedState — fixed object attributes follow schema shape", () => {
	const schema: ResourceSchema = {
		version: 1,
		block: {
			attributes: {
				spec: {
					type: [
						"object",
						{ name: "string", nested: ["object", { size: "number" }] },
					],
					optional: true,
				},
			},
		},
	}

	test("drops undeclared object keys recursively", () => {
		const result = getInputsFromImportedState({
			schema: buildFieldTree(schema),
			state: {
				spec: {
					name: "ok",
					extra: "drop",
					nested: { size: 2, extra: "drop" },
				},
			},
		})
		expect(result).toEqual({ spec: { name: "ok", nested: { size: 2 } } })
	})
})

describe("getInputsFromImportedState — collection object attributes preserve dynamic keys", () => {
	test("projects each map object value through the provider schema", () => {
		const schema: ResourceSchema = {
			version: 1,
			block: {
				attributes: {
					config: {
						type: ["map", ["object", { value: "number" }]],
						optional: true,
					},
				},
			},
		}
		const result = getInputsFromImportedState({
			schema: buildFieldTree(schema),
			state: {
				config: {
					alpha: { value: 1, computed_extra: "drop" },
					beta: { value: 2, computed_extra: "drop" },
				},
			},
		})
		expect(result).toEqual({
			config: {
				alpha: { value: 1 },
				beta: { value: 2 },
			},
		})
	})
})

describe("getInputsFromImportedState — settable fields come from provider flags", () => {
	test("drops attributes that are neither required nor optional", () => {
		const schema: ResourceSchema = {
			version: 1,
			block: {
				attributes: {
					name: { required: true },
					wire_only: {},
				},
			},
		}
		const result = getInputsFromImportedState({
			schema: buildFieldTree(schema),
			state: { name: "app", wire_only: "drop" },
		})
		expect(result).toEqual({ name: "app" })
	})
})

describe("getInputsFromImportedState — aws_security_group-shaped nested block fixture", () => {
	const schema: ResourceSchema = {
		version: 1,
		block: {
			attributes: {
				name: { required: true },
				description: { optional: true },
				id: { computed: true },
				arn: { computed: true },
			},
			block_types: {
				ingress: {
					nesting_mode: "set",
					block: {
						attributes: {
							from_port: { required: true },
							to_port: { required: true },
							protocol: { required: true },
							cidr_blocks: { optional: true },
							self: { optional: true, computed: true },
							security_groups: { optional: true, computed: true },
						},
					},
				},
			},
		},
	}

	const state = {
		name: "my-sg",
		description: "test sg",
		id: "sg-abc123",
		arn: "arn:aws:ec2:us-east-1:123456789012:security-group/sg-abc123",
		ingress: [
			{
				from_port: 80,
				to_port: 80,
				protocol: "tcp",
				cidr_blocks: ["0.0.0.0/0"],
				self: false,
				security_groups: [],
			},
		],
	}

	test("keeps nested user-set fields, drops top-level computed-only", () => {
		const result = getInputsFromImportedState({
			schema: buildFieldTree(schema),
			state,
		})
		expect(result).toHaveProperty("name", "my-sg")
		expect(result).toHaveProperty("description", "test sg")
		expect(result).not.toHaveProperty("id")
		expect(result).not.toHaveProperty("arn")
		expect(result).toHaveProperty("ingress")
	})
})

describe("getInputsFromImportedState — schema owns imported field names", () => {
	const schema: ResourceSchema = {
		version: 1,
		block: {
			attributes: {
				name: { required: true },
				__provider_internal: { optional: true },
			},
		},
	}

	const state = {
		name: "my-resource",
		__provider_internal: "some-value",
	}

	test("keeps provider-declared fields even when the name has a prefix", () => {
		const result = getInputsFromImportedState({
			schema: buildFieldTree(schema),
			state,
		})
		expect(result).toHaveProperty("name", "my-resource")
		expect(result).toHaveProperty("__provider_internal", "some-value")
	})
})

describe("getInputsFromImportedState — empty/missing schema block", () => {
	test("returns empty object when schema has no block", () => {
		const result = getInputsFromImportedState({
			schema: buildFieldTree({ version: 1 }),
			state: { id: "foo" },
		})
		expect(result).toEqual({})
	})
})

describe("getInputsFromImportedState — real aws_vpc schema shape", () => {
	// Schema reconstructed from the Terraform AWS provider's aws_vpc schema:
	// fields in VpcResourceState but absent from VpcInputs are computed-only;
	// fields in VpcInputs are optional, optional+computed, or required.
	const schema: ResourceSchema = {
		version: 1,
		block: {
			attributes: {
				assign_generated_ipv6_cidr_block: { optional: true, computed: true },
				cidr_block: { optional: true, computed: true },
				enable_dns_hostnames: { optional: true, computed: true },
				enable_dns_support: { optional: true, computed: true },
				enable_network_address_usage_metrics: {
					optional: true,
					computed: true,
				},
				id: { optional: true, computed: true },
				instance_tenancy: { optional: true, computed: true },
				ipv4_ipam_pool_id: { optional: true },
				ipv4_netmask_length: { optional: true },
				ipv6_cidr_block: { optional: true, computed: true },
				ipv6_cidr_block_network_border_group: {
					optional: true,
					computed: true,
				},
				ipv6_ipam_pool_id: { optional: true },
				ipv6_netmask_length: { optional: true },
				tags: { optional: true },
				tags_all: { optional: true, computed: true },
				arn: { computed: true },
				default_network_acl_id: { computed: true },
				default_route_table_id: { computed: true },
				default_security_group_id: { computed: true },
				dhcp_options_id: { computed: true },
				ipv6_association_id: { computed: true },
				main_route_table_id: { computed: true },
				owner_id: { computed: true },
			},
		},
	}

	const fullState = {
		arn: "arn:aws:ec2:us-east-1:123456789012:vpc/vpc-abc123",
		assign_generated_ipv6_cidr_block: false,
		cidr_block: "10.0.0.0/16",
		default_network_acl_id: "acl-abc123",
		default_route_table_id: "rtb-abc123",
		default_security_group_id: "sg-abc123",
		dhcp_options_id: "dopt-abc123",
		enable_dns_hostnames: true,
		enable_dns_support: true,
		enable_network_address_usage_metrics: false,
		id: "vpc-abc123",
		instance_tenancy: "default",
		ipv4_ipam_pool_id: null,
		ipv4_netmask_length: null,
		ipv6_association_id: null,
		ipv6_cidr_block: null,
		ipv6_cidr_block_network_border_group: null,
		ipv6_ipam_pool_id: null,
		ipv6_netmask_length: null,
		main_route_table_id: "rtb-abc123",
		owner_id: "123456789012",
		tags: { Name: "my-vpc", env: "prod" },
		tags_all: { Name: "my-vpc", env: "prod" },
	}

	test("drops 8 computed-only outputs; input count drops from 23 to 15", () => {
		const result = getInputsFromImportedState({
			schema: buildFieldTree(schema),
			state: fullState,
		})
		expect(Object.keys(result)).toHaveLength(15)
	})

	test("drops all computed-only fields: arn, default_*, dhcp_options_id, *_association_id, main_route_table_id, owner_id", () => {
		const result = getInputsFromImportedState({
			schema: buildFieldTree(schema),
			state: fullState,
		})
		expect(result).not.toHaveProperty("arn")
		expect(result).not.toHaveProperty("default_network_acl_id")
		expect(result).not.toHaveProperty("default_route_table_id")
		expect(result).not.toHaveProperty("default_security_group_id")
		expect(result).not.toHaveProperty("dhcp_options_id")
		expect(result).not.toHaveProperty("ipv6_association_id")
		expect(result).not.toHaveProperty("main_route_table_id")
		expect(result).not.toHaveProperty("owner_id")
	})

	test("keeps provider-declared optional+computed map attributes", () => {
		const result = getInputsFromImportedState({
			schema: buildFieldTree(schema),
			state: fullState,
		})
		expect(result).toHaveProperty("tags_all")
		expect(result.tags_all).toEqual({ Name: "my-vpc", env: "prod" })
	})

	test("preserves map-type attribute values (tags inner entries are NOT stripped)", () => {
		const result = getInputsFromImportedState({
			schema: buildFieldTree(schema),
			state: fullState,
		})
		expect(result).toHaveProperty("tags")
		expect(result.tags).toEqual({ Name: "my-vpc", env: "prod" })
	})

	test("preserves optional+computed scalar attrs: cidr_block, enable_dns_hostnames, id", () => {
		const result = getInputsFromImportedState({
			schema: buildFieldTree(schema),
			state: fullState,
		})
		expect(result).toHaveProperty("cidr_block", "10.0.0.0/16")
		expect(result).toHaveProperty("enable_dns_hostnames", true)
		expect(result).toHaveProperty("id", "vpc-abc123")
	})
})

describe("getInputsFromImportedState — block_type array items are recursively filtered", () => {
	const schema: ResourceSchema = {
		version: 1,
		block: {
			attributes: {
				name: { required: true },
				id: { computed: true },
			},
			block_types: {
				ingress: {
					nesting_mode: "set",
					block: {
						attributes: {
							from_port: { required: true },
							to_port: { required: true },
							protocol: { required: true },
							cidr_blocks: { optional: true },
							security_group_id: { computed: true },
						},
					},
				},
			},
		},
	}

	const state = {
		name: "my-sg",
		id: "sg-abc123",
		ingress: [
			{
				from_port: 80,
				to_port: 80,
				protocol: "tcp",
				cidr_blocks: ["0.0.0.0/0"],
				security_group_id: "sg-computed",
			},
		],
	}

	test("computed-only fields inside array block elements are filtered out", () => {
		const result = getInputsFromImportedState({
			schema: buildFieldTree(schema),
			state,
		})
		expect(result).not.toHaveProperty("id")
		expect(result).toHaveProperty("name", "my-sg")
		expect(result.ingress).toEqual([
			{
				from_port: 80,
				to_port: 80,
				protocol: "tcp",
				cidr_blocks: ["0.0.0.0/0"],
			},
		])
	})
})

describe("getInputsFromImportedState — map block keys are data, not schema paths", () => {
	const schema: ResourceSchema = {
		version: 1,
		block: {
			block_types: {
				setting: {
					nesting_mode: "map",
					block: {
						attributes: {
							value: { optional: true },
							id: { computed: true },
						},
					},
				},
			},
		},
	}

	test("preserves dynamic map keys and drops computed children", () => {
		const result = getInputsFromImportedState({
			schema: buildFieldTree(schema),
			state: {
				setting: {
					alpha: { value: "one", id: "computed-alpha" },
					beta: { value: "two", id: "computed-beta" },
				},
			},
		})
		expect(result).toEqual({
			setting: {
				alpha: { value: "one" },
				beta: { value: "two" },
			},
		})
	})
})
