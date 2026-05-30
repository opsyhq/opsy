import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ProviderLogo } from "./ProviderLogo"

const provider = {
	id: "aws",
	name: "AWS",
	short: "AWS",
	logo: "aws",
	color: "#ff9900",
}

describe("ProviderLogo", () => {
	it("prefers explicit iconUrl over local icon names", () => {
		const html = renderToStaticMarkup(
			<ProviderLogo
				provider={provider}
				iconName="aws-s3"
				iconUrl="https://assets.example.com/icons/aws/foo.svg"
			/>,
		)

		expect(html).toContain("https://assets.example.com/icons/aws/foo.svg")
		expect(html).not.toContain("/icons/aws/aws-s3.svg")
	})

	it("falls back to local iconName", () => {
		const html = renderToStaticMarkup(
			<ProviderLogo provider={provider} iconName="aws-s3" />,
		)

		expect(html).toContain("/icons/aws/aws-s3.svg")
	})
})
