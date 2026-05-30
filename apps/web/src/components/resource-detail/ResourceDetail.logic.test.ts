import type { ResourceFieldLayoutLlmOutput } from "@opsy/api"
import { describe, expect, it } from "vitest"
import type {
	ResolvedField,
	ResolvedTypeView,
} from "@/components/resource-detail/resolvedTypeView"
import type { FieldLayoutSection } from "@/components/resource-fields/fieldLayout"
import type { ChangeSetItem } from "@/lib/changeSetReactQuery"
import {
	buildDraftSubmitChanges,
	computeDisplayValues,
	computeEditSeed,
	getResourceDetailSections,
	sectionTabIcon,
	toDraftResource,
} from "./ResourceDetail.logic"

function changeSetItem(input: Partial<ChangeSetItem>): ChangeSetItem {
	return {
		id: "item-1",
		kind: "create_resource",
		targetResourceSlug: null,
		resourceType: null,
		changes: null,
		source: "user",
		createdAt: "2026-05-11T00:00:00.000Z",
		dryRun: null,
		validationStatus: "valid",
		validationResult: null,
		applyStatus: "pending",
		applyError: null,
		...input,
	}
}

function field(path: string): ResolvedField {
	return {
		path,
		terraformName: path.split(".").at(-1) ?? path,
		kind: "attribute",
		tfType: "string",
		required: false,
		optional: true,
		sensitive: false,
		computed: false,
		deprecated: false,
		label: path,
		relationships: [],
	}
}

function view(input: {
	type: string
	fields: readonly string[]
	fieldLayout?: ResourceFieldLayoutLlmOutput | null
}): ResolvedTypeView {
	return {
		fields: input.fields.map(field),
		artifacts: {
			kind: "resource",
			type: input.type,
			provider: "aws",
			icon: { data: null, error: null, artifactId: null, status: null },
			metadata: { data: null, error: null, artifactId: null, status: null },
			fieldMetadata: {
				data: null,
				error: null,
				artifactId: null,
				status: null,
			},
			relationshipRules: {
				data: null,
				error: null,
				artifactId: null,
				status: null,
			},
			fieldLayout: {
				data: input.fieldLayout ?? null,
				error: null,
				artifactId: null,
				status: null,
			},
		},
	}
}

function sectionTitles(sections: { section: FieldLayoutSection }[]) {
	return sections.map(({ section }) => section.title)
}

describe("ResourceDetail.logic", () => {
	it("turns a staged create into a draft resource", () => {
		const changes = {
			slug: "web",
			type: "aws_instance",
			inputs: { ami: "ami-123", instance_type: "t3.micro" },
		}
		const draft = toDraftResource(changeSetItem({ changes }))

		expect(draft).toMatchObject({
			itemId: "item-1",
			operation: "create",
			slug: "web",
			provider: "aws",
			type: "aws_instance",
			inputs: changes.inputs,
			changes,
		})
	})

	it("turns a staged import into a draft resource", () => {
		const changes = {
			slug: "imported-vpc",
			type: "aws_vpc",
			inputs: { id: "vpc-123" },
		}
		const draft = toDraftResource(
			changeSetItem({ kind: "import_resource", changes }),
		)

		expect(draft).toMatchObject({
			operation: "import",
			slug: "imported-vpc",
			provider: "aws",
			type: "aws_vpc",
			inputs: changes.inputs,
		})
	})

	it("writes resource draft submissions back to inputs and preserves the changes shape", () => {
		const draft = toDraftResource(
			changeSetItem({
				changes: {
					slug: "web",
					type: "aws_instance",
					integrationSlug: "default",
					position: { x: 1, y: 2 },
					inputs: { ami: "ami-old" },
				},
			}),
		)

		expect(buildDraftSubmitChanges(draft, { ami: "ami-new" })).toEqual({
			slug: "web",
			type: "aws_instance",
			integrationSlug: "default",
			position: { x: 1, y: 2 },
			inputs: { ami: "ami-new" },
		})
	})

	it("returns undefined display values when there is no subject", () => {
		expect(computeDisplayValues(null, null)).toBeUndefined()
	})

	it("returns plannedState as display values for drafts when it is a record", () => {
		const planned = { region: "us-east-1" }
		expect(
			computeDisplayValues(
				// biome-ignore lint/suspicious/noExplicitAny: minimal subject shape for test
				{ kind: "draft", resource: {} as any },
				planned,
			),
		).toEqual(planned)
	})

	it("returns undefined display values for drafts when plannedState is not a record", () => {
		expect(
			computeDisplayValues(
				// biome-ignore lint/suspicious/noExplicitAny: minimal subject shape for test
				{ kind: "draft", resource: {} as any },
				"not-a-record",
			),
		).toBeUndefined()
	})

	it("merges existing inputs and outputs (outputs win)", () => {
		const resource = {
			inputs: { a: 1, b: 2 },
			outputs: { b: 99, c: 3 },
		}
		expect(
			computeDisplayValues(
				// biome-ignore lint/suspicious/noExplicitAny: minimal resource shape for test
				{ kind: "existing", resource: resource as any },
				null,
			),
		).toEqual({ a: 1, b: 99, c: 3 })
	})

	it("overlays resource inputs on top of display values for the edit seed", () => {
		expect(computeEditSeed({ a: 1, b: 2 }, { b: 99, c: 3 })).toEqual({
			a: 1,
			b: 99,
			c: 3,
		})
	})

	it("falls back to just resource values when display values are undefined", () => {
		expect(computeEditSeed(undefined, { a: 1 })).toEqual({ a: 1 })
	})

	it("returns the same fallback icon for the same section title (deterministic)", () => {
		expect(sectionTabIcon("Floofbar")).toBe(sectionTabIcon("Floofbar"))
	})

	it("matches keyword-based icons when the section title contains a known keyword", () => {
		expect(sectionTabIcon("Network configuration")).toBe(
			sectionTabIcon("Network configuration"),
		)
	})

	it("resolves detail tabs from the server field-layout spec", () => {
		// No view and a view with no server spec both fall back to the flat form.
		expect(getResourceDetailSections(undefined)).toEqual([])
		expect(
			getResourceDetailSections(
				view({ type: "aws_subnet", fields: ["vpc_id"] }),
			),
		).toEqual([])

		expect(
			sectionTitles(
				getResourceDetailSections(
					view({
						type: "aws_subnet",
						fields: ["vpc_id", "cidr_block"],
						fieldLayout: {
							create: { title: "Create", rows: ["vpc_id"] },
							sections: [
								{ title: "Details", rows: ["vpc_id"] },
								{ title: "Networking", rows: ["cidr_block"] },
							],
						},
					}),
				),
			),
		).toEqual(["Details", "Networking"])
	})
})
