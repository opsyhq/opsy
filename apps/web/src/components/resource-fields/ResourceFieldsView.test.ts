import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type {
	ResolvedField,
	ResolvedTypeView,
} from "@/components/resource-detail/resolvedTypeView"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ResourceFieldsView } from "./ResourceFieldsView"

function field(
	input: Partial<ResolvedField> & { path: string },
): ResolvedField {
	const { path, ...rest } = input
	return {
		path,
		terraformName: path,
		kind: "attribute",
		tfType: "string",
		required: true,
		optional: false,
		sensitive: false,
		computed: false,
		deprecated: false,
		label: path,
		relationships: [],
		...rest,
	}
}

function view(fields: ResolvedField[]): ResolvedTypeView {
	return {
		fields,
		artifacts: {
			kind: "resource",
			type: "aws_instance",
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
				data: null,
				error: null,
				artifactId: null,
				status: null,
			},
		},
	}
}

function vpcRelationship(): ResolvedField["relationships"][number] {
	return {
		key: "vpc-rule",
		fieldPath: "vpc_id",
		selectable: {
			kind: "resource",
			type: "aws_vpc",
			path: "id",
		},
		cardinality: "one",
	}
}

describe("ResourceFieldsView", () => {
	it("uses generated help, not Terraform descriptions, in read-only field tooltips", () => {
		const html = renderToStaticMarkup(
			createElement(
				TooltipProvider,
				null,
				createElement(ResourceFieldsView, {
					view: view([
						field({
							path: "vpc_id",
							description: "Terraform VPC description.",
							help: "Choose the network boundary this resource should join.",
							icon: "lucide:network",
						}),
					]),
					values: { vpc_id: "vpc-123" },
				}),
			),
		)

		expect(html).toContain("Field help for vpc_id")
		expect(html).toContain('data-field-icon="lucide:network"')
		expect(html).not.toContain("Terraform VPC description.")
	})

	it("renders nested child metadata and values from objects, arrays, and maps", () => {
		const html = renderToStaticMarkup(
			createElement(
				TooltipProvider,
				null,
				createElement(ResourceFieldsView, {
					view: view([
						field({
							path: "root_block_device",
							terraformName: "root_block_device",
							kind: "block",
							nestingMode: "single",
							minItems: 1,
							maxItems: 1,
							label: "Root volume",
							children: [
								field({
									path: "root_block_device.volume_size",
									terraformName: "volume_size",
									tfType: "number",
									label: "Volume size",
									help: "Boot disk size.",
								}),
							],
						}),
						field({
							path: "ingress",
							terraformName: "ingress",
							kind: "block",
							nestingMode: "set",
							minItems: 0,
							label: "Ingress",
							children: [
								field({
									path: "ingress.from_port",
									terraformName: "from_port",
									tfType: "number",
									label: "From port",
								}),
							],
						}),
						field({
							path: "rules",
							terraformName: "rules",
							kind: "block",
							nestingMode: "map",
							label: "Rules",
							children: [
								field({
									path: "rules.port",
									terraformName: "port",
									tfType: "number",
									label: "Rule port",
								}),
							],
						}),
					]),
					values: {
						root_block_device: { volume_size: 20 },
						ingress: [{ from_port: 80 }, { from_port: 443 }],
						rules: {
							web: { port: 80 },
							ssh: { port: 22 },
						},
					},
				}),
			),
		)

		expect(html).toContain("Root volume")
		expect(html).toContain("Volume size")
		expect(html).toContain("20")
		expect(html).toContain("From port")
		expect(html).toContain("Ingress 1")
		expect(html).toContain("Ingress 2")
		expect(html).toContain("443")
		expect(html).toContain("Rule port")
		expect(html).toContain("web")
		expect(html).toContain("ssh")
		expect(html).toContain("22")
		expect(html).not.toContain("[object Object]")
	})

	// A max_items==1 singleton block is TF-native `[ {…} ]` — the value view
	// reads it through the same array path as any block collection (consistent
	// with the form input); absent renders nothing.
	it("renders a singleton block value through the array path; nothing when absent", () => {
		const versioning = () =>
			field({
				path: "versioning",
				terraformName: "versioning",
				kind: "block",
				nestingMode: "list",
				minItems: 0,
				maxItems: 1,
				label: "Versioning",
				children: [
					field({
						path: "versioning.enabled",
						terraformName: "enabled",
						tfType: "bool",
						label: "Enabled",
					}),
				],
			})

		const present = renderToStaticMarkup(
			createElement(
				TooltipProvider,
				null,
				createElement(ResourceFieldsView, {
					view: view([versioning()]),
					values: { versioning: [{ enabled: true }] },
				}),
			),
		)
		expect(present).toContain("Enabled")
		expect(present).toContain("true")
		expect(present).not.toContain("[object Object]")

		const absent = renderToStaticMarkup(
			createElement(
				TooltipProvider,
				null,
				createElement(ResourceFieldsView, {
					view: view([versioning()]),
					values: {},
				}),
			),
		)
		expect(absent).toContain("Versioning")
		expect(absent).not.toContain("Enabled")
	})

	it("renders relationship refs as linked resources instead of object strings", () => {
		const html = renderToStaticMarkup(
			createElement(
				TooltipProvider,
				null,
				createElement(ResourceFieldsView, {
					view: view([
						field({
							path: "vpc_id",
							label: "VPC",
							relationships: [vpcRelationship()],
						}),
					]),
					values: {
						vpc_id: { $ref: "opsy-staging-vpc.id" },
					},
				}),
			),
		)

		expect(html).toContain("opsy-staging-vpc")
		expect(html).toContain("linked id")
		expect(html).not.toContain("[object Object]")
	})
})
