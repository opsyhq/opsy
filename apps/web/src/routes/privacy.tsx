import { createFileRoute } from "@tanstack/react-router"
import { PrivacyDocument } from "./-legalContent"

export const Route = createFileRoute("/privacy")({
	component: PrivacyDocument,
	head: () => ({
		meta: [{ title: "Privacy Policy - Opsy" }],
	}),
})
