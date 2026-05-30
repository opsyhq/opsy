import { createFileRoute } from "@tanstack/react-router"
import { TermsDocument } from "./-legalContent"

export const Route = createFileRoute("/terms")({
	component: TermsDocument,
	head: () => ({
		meta: [{ title: "Terms of Service - Opsy" }],
	}),
})
