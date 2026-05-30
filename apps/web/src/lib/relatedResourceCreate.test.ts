import { describe, expect, it } from "vitest"
import { writeRelatedReference } from "./relatedResourceCreate"

describe("related resource create", () => {
	it("writes a scalar reference at a root field", () => {
		expect(
			writeRelatedReference({
				values: { name: "instance" },
				fieldPath: "subnet_id",
				ref: "private-subnet.id",
				cardinality: "one",
			}),
		).toEqual({
			name: "instance",
			subnet_id: { $ref: "private-subnet.id" },
		})
	})

	it("writes a nested reference without dropping sibling values", () => {
		expect(
			writeRelatedReference({
				values: { network: { assign_public_ip: false } },
				fieldPath: "network.subnet_id",
				ref: "private-subnet.id",
				cardinality: "one",
			}),
		).toEqual({
			network: {
				assign_public_ip: false,
				subnet_id: { $ref: "private-subnet.id" },
			},
		})
	})

	it("writes a reference at a concrete array row field path", () => {
		expect(
			writeRelatedReference({
				values: {
					network_interface: [
						{ subnet_id: { $ref: "public-subnet.id" } },
						{ description: "private" },
					],
				},
				fieldPath: "network_interface[1].subnet_id",
				ref: "private-subnet.id",
				cardinality: "one",
			}),
		).toEqual({
			network_interface: [
				{ subnet_id: { $ref: "public-subnet.id" } },
				{
					description: "private",
					subnet_id: { $ref: "private-subnet.id" },
				},
			],
		})
	})

	it("appends many-cardinality references", () => {
		expect(
			writeRelatedReference({
				values: { security_group_ids: [{ $ref: "web-sg.id" }] },
				fieldPath: "security_group_ids",
				ref: "ssh-sg.id",
				cardinality: "many",
			}),
		).toEqual({
			security_group_ids: [{ $ref: "web-sg.id" }, { $ref: "ssh-sg.id" }],
		})
	})
})
