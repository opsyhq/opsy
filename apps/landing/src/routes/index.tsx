import { usePostHog } from "@posthog/react"
import { createFileRoute } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"
import { CliInstall } from "@/components/CliInstall"
import { OpsyLogo } from "@/components/OpsyLogo"
import { appLoginUrl } from "@/lib/app-url"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
	const loginUrl = appLoginUrl()
	const posthog = usePostHog()

	return (
		<>
			<div className="grain" aria-hidden />

			<main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-20">
				<div className="mx-auto flex w-full max-w-[42rem] flex-col items-center text-center">
					<div className="mark mb-10 h-[68px] w-[68px]">
						<OpsyLogo className="h-full w-full" />
					</div>

					<span
						className="badge reveal"
						style={{ animationDelay: "0.15s" }}
					>
						<span className="dot" />
						Beta
					</span>

					<h1
						className="reveal mt-7 max-w-[16ch] text-balance text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.035em] text-[var(--fg)] sm:text-[3.6rem]"
						style={{ animationDelay: "0.25s" }}
					>
						Make every cloud feel like one.
					</h1>

					<p
						className="reveal mt-6 max-w-[36ch] text-pretty text-[1.05rem] leading-relaxed text-[var(--fg-dim)] sm:text-[1.12rem]"
						style={{ animationDelay: "0.35s" }}
					>
						A modern, visual control plane for cloud
						infrastructure.
					</p>

					<div
						className="reveal mt-9"
						style={{ animationDelay: "0.45s" }}
					>
						<a
							className="cta"
							href={loginUrl}
							onClick={() =>
								posthog.capture("cta_clicked", {
									destination: loginUrl,
								})
							}
						>
							Get started
							<ArrowRight size={17} strokeWidth={2.25} />
						</a>
					</div>

					<div
						className="reveal mt-8"
						style={{ animationDelay: "0.55s" }}
					>
						<CliInstall />
					</div>
				</div>

				<footer className="absolute inset-x-0 bottom-0 flex items-center justify-between px-7 py-6">
					<span className="foot">Opsy</span>
					<span className="foot">© 2026</span>
				</footer>
			</main>
		</>
	)
}
