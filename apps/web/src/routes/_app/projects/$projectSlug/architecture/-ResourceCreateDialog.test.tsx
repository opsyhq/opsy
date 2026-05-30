import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { TypeRow } from "@/components/ResourcePickerWizard"
import { buildTypedResourceItem } from "./-ResourceCreateDialog"

function renderRow(
	metadata: Parameters<typeof TypeRow>[0]["hit"]["artifacts"]["metadata"],
) {
	const queryClient = new QueryClient()
	return renderToStaticMarkup(
		<QueryClientProvider client={queryClient}>
			<TypeRow
				hit={{
					provider: "aws",
					type: "aws_instance",
					kinds: ["resource"],
					artifacts: { icon: null, metadata },
				}}
				pending={false}
				actionLabel="Create"
				onStage={vi.fn()}
			/>
		</QueryClientProvider>,
	)
}

describe("TypeRow", () => {
	it("shows the raw Terraform type while metadata is loading", () => {
		const html = renderRow({
			artifactId: "artifact-1",
			status: "pending",
			data: null,
			error: null,
		})

		expect(html).toContain("aws_instance")
		expect(html).toContain("Loading type metadata")
		expect(html).not.toContain('data-slot="skeleton"')
	})

	it("replaces the raw Terraform type with the generated name when ready", () => {
		const html = renderRow({
			artifactId: "artifact-1",
			status: "ready",
			data: { name: "EC2 Instance", display: "card" },
			error: null,
		})

		expect(html).toContain("EC2 Instance")
		expect(html).not.toContain("aws_instance")
	})
})

// buildTypedResourceItem is the pure shaper extracted out of the staging
// callback. Pinning its output is what actually guards #12 (the vestigial
// positional kind arg mis-shaping the create body) — by contract, not by
// asserting on the source text of the call site.
describe("buildTypedResourceItem", () => {
	const base = {
		slug: "instance-ab12c",
		type: "aws_instance",
		integrationSlug: "aws-prod",
	}

	it("shapes a create_resource body with empty inputs", () => {
		expect(buildTypedResourceItem(base)).toEqual({
			kind: "create_resource",
			changes: {
				slug: "instance-ab12c",
				type: "aws_instance",
				integrationSlug: "aws-prod",
				inputs: {},
			},
		})
	})

	it("includes a trimmed displayName only when metadataName is non-empty", () => {
		expect(
			buildTypedResourceItem({ ...base, metadataName: "  EC2 Instance  " })
				.changes,
		).toMatchObject({ displayName: "EC2 Instance" })

		for (const metadataName of [null, undefined, "", "   "]) {
			expect(
				buildTypedResourceItem({ ...base, metadataName }).changes,
			).not.toHaveProperty("displayName")
		}
	})

	it("includes position only when provided", () => {
		expect(
			buildTypedResourceItem({ ...base, position: { x: 1, y: 2 } }).changes,
		).toMatchObject({ position: { x: 1, y: 2 } })

		for (const position of [null, undefined]) {
			expect(
				buildTypedResourceItem({ ...base, position }).changes,
			).not.toHaveProperty("position")
		}
	})
})
