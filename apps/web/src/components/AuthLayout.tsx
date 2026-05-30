import type * as React from "react"
import { OpsyLogo } from "@/components/brand"

interface AuthLayoutProps {
	title: string
	description?: React.ReactNode
	// Optional: some pre-auth screens (e.g. an unavailable-invitation notice)
	// are title + description only, with no form or actions below.
	children?: React.ReactNode
}

/**
 * Minimal, Linear-style shell for pre-auth screens. No card chrome — depth
 * comes from typography hierarchy, spacing, and a single neutral top vignette
 * so the form reads as deliberately understated rather than empty.
 */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
	return (
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-10%,color-mix(in_oklch,var(--color-foreground)_5%,transparent),transparent)]"
			/>
			<main className="relative w-full max-w-[340px] py-16">
				<header className="mb-9 flex flex-col items-center text-center">
					<OpsyLogo className="mb-6 size-12 text-foreground" />
					<h1 className="text-xl font-semibold tracking-tight text-foreground">
						{title}
					</h1>
					{description && (
						<p className="mt-2 text-pretty text-sm text-muted-foreground">
							{description}
						</p>
					)}
				</header>
				{children}
			</main>
		</div>
	)
}
