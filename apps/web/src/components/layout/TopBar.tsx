import { Link } from "@tanstack/react-router"
import { OpsyLogo } from "@/components/brand"
import { ProjectSwitcher } from "@/components/layout/ProjectSwitcher"
import { APP_RAIL_WIDTH_COLLAPSED } from "@/components/layout/railWidths"
import { useActiveProjectSlug } from "@/components/layout/use-project-slug"

export function TopBar() {
	const activeSlug = useActiveProjectSlug()

	return (
		<header className="flex h-14 shrink-0 items-center">
			<div
				className="flex shrink-0 items-center justify-center"
				style={{ width: APP_RAIL_WIDTH_COLLAPSED }}
			>
				<Link
					to="/projects"
					aria-label="Opsy"
					className="inline-flex size-8 items-center justify-center text-foreground"
				>
					<OpsyLogo className="size-8" />
				</Link>
			</div>

			{activeSlug && (
				<div className="ml-3">
					<ProjectSwitcher activeSlug={activeSlug} />
				</div>
			)}
		</header>
	)
}
