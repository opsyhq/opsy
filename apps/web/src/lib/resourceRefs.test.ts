import { describe, expect, it } from "vitest"
import type { ResolvedField } from "@/components/resource-detail/resolvedTypeView"
import type { ProjectResource } from "@/lib/projectReactQuery"
import {
	isRefValue,
	makeRefValue,
	parseRefString,
	parseRefValue,
	referenceValueForSelection,
	selectFieldReferenceCandidates,
	selectResourceReferenceCandidates,
} from "./resourceRefs"

function relationship(
	input: Partial<ResolvedField["relationships"][number]> = {},
): ResolvedField["relationships"][number] {
	return {
		key: "rule",
		fieldPath: "subnet_id",
		selectable: { kind: "resource", type: "aws_subnet", path: "id" },
		cardinality: "one",
		...input,
	}
}

describe("resource refs", () => {
	it("parses and creates authored $ref values", () => {
		expect(isRefValue({ $ref: "subnet.id" })).toBe(true)
		expect(parseRefValue({ $ref: "subnet.id" })).toBe("subnet.id")
		expect(parseRefString("subnet.tags[0].name")).toEqual({
			slug: "subnet",
			path: "tags[0].name",
		})
		expect(parseRefString("not a ref")).toBeNull()
		expect(parseRefValue({ $ref: 123 })).toBeNull()
		expect(parseRefValue("subnet.id")).toBeNull()
		expect(makeRefValue("subnet.id")).toEqual({ $ref: "subnet.id" })
	})

	it("selects picker targets from relationship rules and graph resources", () => {
		const subnetA = {
			id: "subnet-a",
			slug: "subnet-a",
			type: "aws_subnet",
			status: "live",
			metadata: {},
		} as unknown as ProjectResource
		const subnetB = {
			...subnetA,
			id: "subnet-b",
			slug: "subnet-b",
			metadata: { displayName: "Private subnet" },
		} as unknown as ProjectResource
		const creatingSubnet = {
			...subnetA,
			id: "subnet-creating",
			slug: "subnet-creating",
			status: "creating",
		} as unknown as ProjectResource
		const instance = {
			...subnetA,
			id: "instance",
			slug: "instance",
			type: "aws_instance",
		} as unknown as ProjectResource

		expect(
			selectFieldReferenceCandidates({
				relationships: [
					relationship(),
					relationship({
						key: "duplicate",
						selectable: { kind: "resource", type: "aws_subnet", path: "id" },
					}),
				],
				resources: [subnetB, creatingSubnet, instance, subnetA],
			}),
		).toEqual([
			{
				id: "subnet-a",
				slug: "subnet-a",
				type: "aws_subnet",
				displayName: null,
				ref: { $ref: "subnet-a.id" },
			},
			{
				id: "subnet-b",
				slug: "subnet-b",
				type: "aws_subnet",
				displayName: "Private subnet",
				ref: { $ref: "subnet-b.id" },
			},
		])
	})

	it("selects dynamic $ autocomplete targets from graph resource fields", () => {
		const bucket = {
			id: "bucket",
			slug: "assets",
			type: "aws_s3_bucket",
			provider: "aws",
			status: "live",
			inputs: { bucket: "assets-prod", tags: { env: "prod" } },
			metadata: { displayName: "Assets bucket" },
		} as unknown as ProjectResource
		const creatingBucket = {
			...bucket,
			id: "creating-bucket",
			slug: "creating-assets",
			status: "creating",
		} as unknown as ProjectResource
		const referenceFieldsByTypeKey = new Map<string, string[]>([
			["aws:resource:aws_s3_bucket", ["arn", "bucket", "id"]],
		])

		expect(
			selectResourceReferenceCandidates({
				resources: [bucket, creatingBucket],
				referenceFieldsByTypeKey,
			}),
		).toEqual([
			{
				id: "bucket",
				slug: "assets",
				type: "aws_s3_bucket",
				displayName: "Assets bucket",
				ref: { $ref: "assets.arn" },
			},
			{
				id: "bucket",
				slug: "assets",
				type: "aws_s3_bucket",
				displayName: "Assets bucket",
				ref: { $ref: "assets.bucket" },
			},
			{
				id: "bucket",
				slug: "assets",
				type: "aws_s3_bucket",
				displayName: "Assets bucket",
				ref: { $ref: "assets.id" },
			},
		])
	})

	it("writes scalar and many-cardinality ref selections", () => {
		expect(
			referenceValueForSelection({
				value: "manual",
				ref: "subnet-a.id",
				cardinality: "one",
			}),
		).toEqual({ $ref: "subnet-a.id" })
		expect(
			referenceValueForSelection({
				value: [{ $ref: "sg-a.id" }],
				ref: "sg-b.id",
				cardinality: "many",
				selected: true,
			}),
		).toEqual([{ $ref: "sg-a.id" }, { $ref: "sg-b.id" }])
		expect(
			referenceValueForSelection({
				value: [{ $ref: "sg-a.id" }, { $ref: "sg-b.id" }],
				ref: "sg-a.id",
				cardinality: "many",
				selected: false,
			}),
		).toEqual([{ $ref: "sg-b.id" }])
	})
})
