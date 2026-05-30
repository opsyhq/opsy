import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type {
	ResolvedField,
	ResolvedTypeView,
} from "@/components/resource-detail/resolvedTypeView"
import { TooltipProvider } from "@/components/ui/tooltip"
import { FieldRenderer } from "./FieldRenderer"
import { ResourceFieldsForm } from "./ResourceFieldsForm"

function field(
	input: Partial<ResolvedField> & { path: string },
): ResolvedField {
	const { path, ...rest } = input
	return {
		path,
		terraformName: path,
		kind: "attribute",
		tfType: "string",
		required: false,
		optional: true,
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

function subnetRelationship(): ResolvedField["relationships"][number] {
	return {
		key: "subnet-rule",
		fieldPath: "subnet_id",
		selectable: {
			kind: "resource",
			type: "aws_subnet",
			path: "id",
		},
		cardinality: "one",
	}
}

describe("ResourceFieldsForm help", () => {
	it("renders generated help and ignores Terraform descriptions", () => {
		const html = renderToStaticMarkup(
			createElement(
				TooltipProvider,
				null,
				createElement(ResourceFieldsForm, {
					view: view([
						field({
							path: "ami",
							required: true,
							optional: false,
							description: "Terraform AMI description.",
							help: "Generated AMI help.",
							icon: "lucide:hard-drive",
						}),
					]),
					value: {},
					onChange: () => undefined,
				}),
			),
		)

		expect(html).toContain("Field help for ami")
		expect(html).toContain('data-field-icon="lucide:hard-drive"')
		expect(html).not.toContain("Terraform AMI description.")
	})

	it("renders singleton object children as controls", () => {
		const html = renderToStaticMarkup(
			createElement(
				TooltipProvider,
				null,
				createElement(ResourceFieldsForm, {
					view: view([
						field({
							path: "root_block_device",
							terraformName: "root_block_device",
							kind: "block",
							nestingMode: "single",
							minItems: 1,
							maxItems: 1,
							required: true,
							optional: false,
							label: "Root volume",
							children: [
								field({
									path: "root_block_device.volume_size",
									terraformName: "volume_size",
									tfType: "number",
									label: "Volume size",
									help: "Set the boot disk size.",
								}),
							],
						}),
					]),
					value: {},
					onChange: () => undefined,
				}),
			),
		)

		expect(html).toContain("Root volume")
		expect(html).toContain("Volume size")
		expect(html).toContain("Field help for Volume size")
		expect(html).toContain('type="number"')
		expect(html).not.toContain("<textarea")
	})

	it("renders nested relationship controls inside object fields", () => {
		const queryClient = new QueryClient()
		const html = renderToStaticMarkup(
			createElement(
				QueryClientProvider,
				{ client: queryClient },
				createElement(ResourceFieldsForm, {
					view: view([
						field({
							path: "network",
							terraformName: "network",
							kind: "block",
							nestingMode: "single",
							minItems: 1,
							maxItems: 1,
							label: "Network",
							children: [
								field({
									path: "network.subnet_id",
									terraformName: "subnet_id",
									label: "Subnet",
									relationships: [subnetRelationship()],
								}),
							],
						}),
					]),
					value: {},
					projectSlug: "opsy",
					onChange: () => undefined,
				}),
			),
		)

		expect(html).toContain("Select aws_subnet or type a value")
	})

	it("passes concrete array paths to nested relationship targets", () => {
		const fieldPaths: string[] = []
		renderToStaticMarkup(
			createElement(FieldRenderer, {
				field: field({
					path: "network_interface",
					terraformName: "network_interface",
					kind: "block",
					nestingMode: "list",
					minItems: 0,
					label: "Network interface",
					children: [
						field({
							path: "network_interface.subnet_id",
							terraformName: "subnet_id",
							label: "Subnet",
							relationships: [subnetRelationship()],
						}),
					],
				}),
				kind: "object-array",
				rhf: {
					value: [{ description: "primary" }],
					onChange: () => undefined,
					onBlur: () => undefined,
				},
				buildRelationship: (childField, picker) => {
					fieldPaths.push(childField.path)
					return {
						relationship: picker,
						candidates: [],
						isLoading: false,
						isError: false,
						createTargets: [],
					}
				},
			}),
		)

		expect(fieldPaths).toEqual(["network_interface.subnet_id"])
	})

	it("passes concrete map paths to nested relationship targets", () => {
		const fieldPaths: string[] = []
		renderToStaticMarkup(
			createElement(FieldRenderer, {
				field: field({
					path: "targets",
					terraformName: "targets",
					kind: "block",
					nestingMode: "map",
					label: "Targets",
					children: [
						field({
							path: "targets.subnet_id",
							terraformName: "subnet_id",
							label: "Subnet",
							relationships: [subnetRelationship()],
						}),
					],
				}),
				kind: "object-map",
				rhf: {
					value: { primary: {} },
					onChange: () => undefined,
					onBlur: () => undefined,
				},
				buildRelationship: (childField, picker) => {
					fieldPaths.push(childField.path)
					return {
						relationship: picker,
						candidates: [],
						isLoading: false,
						isError: false,
						createTargets: [],
					}
				},
			}),
		)

		expect(fieldPaths).toEqual(["targets.subnet_id"])
	})

	it("renders repeated object fields from schema children", () => {
		const html = renderToStaticMarkup(
			createElement(
				TooltipProvider,
				null,
				createElement(ResourceFieldsForm, {
					view: view([
						field({
							path: "ingress",
							terraformName: "ingress",
							kind: "block",
							nestingMode: "set",
							minItems: 0,
							maxItems: 10,
							required: true,
							optional: false,
							label: "Ingress",
							children: [
								field({
									path: "ingress.from_port",
									terraformName: "from_port",
									tfType: "number",
									label: "From port",
									help: "Start of the allowed port range.",
								}),
							],
						}),
					]),
					value: { ingress: [{}] },
					onChange: () => undefined,
				}),
			),
		)

		expect(html).toContain("Add Ingress")
		expect(html).toContain("1/10")
		expect(html).toContain("From port")
		expect(html).toContain("Field help for From port")
		expect(html).not.toContain("<textarea")
	})

	// A max_items==1 singleton block is the repeatable collection control
	// capped at 1 — "Add Versioning" / Remove / 1/1 — NOT an enable checkbox
	// and NOT an always-present inline group. Value is TF-native `[ {…} ]`.
	const versioningBlock = () =>
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

	it("renders an absent singleton block as 'Add X' capped at 1, no toggle", () => {
		const html = renderToStaticMarkup(
			createElement(
				TooltipProvider,
				null,
				createElement(ResourceFieldsForm, {
					view: view([versioningBlock()]),
					value: {},
					onChange: () => undefined,
				}),
			),
		)

		expect(html).toContain("Add Versioning")
		expect(html).toContain("0/1")
		// No enable-checkbox / "Added" affordance — it's the collection control.
		expect(html).not.toContain("Added")
		// Child only materializes once a row is added.
		expect(html).not.toContain("Enabled")
	})

	it("renders a present singleton block as one inline group with Remove + 1/1", () => {
		const html = renderToStaticMarkup(
			createElement(
				TooltipProvider,
				null,
				createElement(ResourceFieldsForm, {
					view: view([versioningBlock()]),
					value: { versioning: [{ enabled: true }] },
					onChange: () => undefined,
				}),
			),
		)

		expect(html).toContain("1/1")
		expect(html).toContain("Remove Versioning")
		expect(html).toContain("Enabled")
		expect(html).not.toContain("Added")
	})

	it("renders every writable field without a More fields fold", () => {
		const html = renderToStaticMarkup(
			createElement(ResourceFieldsForm, {
				view: view([
					field({
						path: "name",
						required: true,
						optional: false,
						label: "Name",
					}),
					field({ path: "description", label: "Description" }),
				]),
				value: {},
				onChange: () => undefined,
			}),
		)

		expect(html).toContain("Name")
		expect(html).toContain("Description")
		expect(html).not.toContain("More fields")
	})

	it("renders authored refs in plain text fields", () => {
		const html = renderToStaticMarkup(
			createElement(ResourceFieldsForm, {
				view: view([
					field({ path: "bucket_namespace", label: "Bucket Namespace" }),
				]),
				value: { bucket_namespace: { $ref: "assets.bucket" } },
				onChange: () => undefined,
			}),
		)

		expect(html).not.toContain("Linked resource")
		expect(html).not.toContain("Select resource")
		expect(html).toContain("assets")
		expect(html).toContain("bucket")
		expect(html).not.toContain("$ref")
	})

	it("keeps empty plain text fields as plain inputs", () => {
		const queryClient = new QueryClient()
		const html = renderToStaticMarkup(
			createElement(
				QueryClientProvider,
				{ client: queryClient },
				createElement(ResourceFieldsForm, {
					view: view([
						field({ path: "bucket_namespace", label: "Bucket Namespace" }),
					]),
					value: {},
					projectSlug: "opsy",
					onChange: () => undefined,
				}),
			),
		)

		expect(html).toContain('type="text"')
		expect(html).not.toContain("Linked resource")
		expect(html).not.toContain("Select resource")
	})

	it("renders prototype layout groups as collapsible sections", () => {
		const groupedField = field({
			path: "source_dest_check",
			label: "Source/destination check",
		})
		const html = renderToStaticMarkup(
			createElement(ResourceFieldsForm, {
				view: view([groupedField]),
				value: {},
				layoutRows: [
					{
						title: "Advanced networking",
						rows: [groupedField],
					},
				],
				onChange: () => undefined,
			}),
		)

		expect(html).toContain("Advanced networking")
		expect(html).toContain("Source/destination check")
		expect(html).toContain("<details")
		expect(html).not.toContain("<details open")
	})

	it("allows layout groups to opt into being open", () => {
		const groupedField = field({
			path: "tags",
			label: "Tags",
		})
		const html = renderToStaticMarkup(
			createElement(ResourceFieldsForm, {
				view: view([groupedField]),
				value: {},
				layoutRows: [
					{
						title: "Labels",
						collapsed: false,
						rows: [groupedField],
					},
				],
				onChange: () => undefined,
			}),
		)

		expect(html).toContain("Labels")
		expect(html).toContain('open=""')
	})

	it("renders one-cardinality relationship pickers as an autocomplete", () => {
		const queryClient = new QueryClient()
		const html = renderToStaticMarkup(
			createElement(
				QueryClientProvider,
				{ client: queryClient },
				createElement(ResourceFieldsForm, {
					view: view([
						field({
							path: "subnet_id",
							label: "Subnet",
							required: true,
							optional: false,
							relationships: [subnetRelationship()],
						}),
					]),
					value: {},
					projectSlug: "opsy",
					onChange: () => undefined,
				}),
			),
		)

		expect(html).toContain("Select aws_subnet or type a value")
		expect(html).not.toContain("Linked resource")
		expect(html).not.toContain("Manual value")
		expect(html).not.toContain("__opsy_no_ref__")
	})

	it("renders one picker for duplicate alias relationships on a field", () => {
		const queryClient = new QueryClient()
		const html = renderToStaticMarkup(
			createElement(
				QueryClientProvider,
				{ client: queryClient },
				createElement(ResourceFieldsForm, {
					view: view([
						field({
							path: "load_balancer_arn",
							label: "Load balancer",
							required: true,
							optional: false,
							relationships: [
								{
									key: "lb-rule",
									fieldPath: "load_balancer_arn",
									selectable: {
										kind: "resource",
										type: "aws_lb",
										path: "arn",
									},
									cardinality: "one",
								},
								{
									key: "alb-rule",
									fieldPath: "load_balancer_arn",
									selectable: {
										kind: "resource",
										type: "aws_alb",
										path: "arn",
									},
									cardinality: "one",
								},
							],
						}),
					]),
					value: {},
					projectSlug: "opsy",
					onChange: () => undefined,
				}),
			),
		)

		expect(html).toContain("Select aws_lb / aws_alb or type a value")
		expect(html).not.toContain("Type and press Enter")
	})

	it("renders many-cardinality relationship pickers", () => {
		const queryClient = new QueryClient()
		const html = renderToStaticMarkup(
			createElement(
				QueryClientProvider,
				{ client: queryClient },
				createElement(ResourceFieldsForm, {
					view: view([
						field({
							path: "subnet_id",
							label: "Subnet",
							required: true,
							optional: false,
							relationships: [subnetRelationship()],
						}),
						field({
							path: "vpc_security_group_ids",
							label: "Security groups",
							tfType: ["set", "string"],
							required: true,
							optional: false,
							relationships: [
								{
									key: "security-groups-rule",
									fieldPath: "vpc_security_group_ids",
									selectable: {
										kind: "resource",
										type: "aws_security_group",
										path: "id",
									},
									cardinality: "many",
								},
							],
						}),
					]),
					value: {},
					projectSlug: "opsy",
					onChange: () => undefined,
				}),
			),
		)

		expect(html).toContain("Select aws_subnet or type a value")
		expect(html).toContain("Add aws_security_group or type a value")
		expect(html).not.toContain("Type and press Enter")
	})

	it("shows raw scalar relationship values inline without a mode toggle", () => {
		const queryClient = new QueryClient()
		const html = renderToStaticMarkup(
			createElement(
				QueryClientProvider,
				{ client: queryClient },
				createElement(ResourceFieldsForm, {
					view: view([
						field({
							path: "subnet_id",
							label: "Subnet",
							required: true,
							optional: false,
							relationships: [subnetRelationship()],
						}),
					]),
					value: { subnet_id: "subnet-123" },
					projectSlug: "opsy",
					onChange: () => undefined,
				}),
			),
		)

		expect(html).toContain('value="subnet-123"')
		expect(html).not.toContain("Manual value")
		expect(html).not.toContain("Linked resource")
	})
})
