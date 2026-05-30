import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { projectsQueryOptions } from "@/lib/projectReactQuery"
import { projectColor } from "@/routes/_app/projects/-projectColor"

export function ProjectSwitcher({ activeSlug }: { activeSlug?: string }) {
	const { data } = useSuspenseQuery(projectsQueryOptions())
	const projects = data.projects

	if (projects.length === 0) return null

	const active = projects.find((p) => p.slug === activeSlug)
	const displaySlug = active?.slug ?? projects[0]?.slug

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="h-8 gap-2 rounded-lg border bg-canvas-bg px-2 pr-2.5 font-medium hover:bg-canvas-bg dark:hover:bg-canvas-bg focus-visible:ring-0"
				>
					<span
						aria-hidden
						className="size-3 shrink-0 rounded-full"
						style={{ backgroundColor: projectColor(displaySlug ?? "") }}
					/>
					<span className="font-mono text-xs">{displaySlug ?? "—"}</span>
					<ChevronsUpDown className="size-3 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" sideOffset={8} className="w-56">
				{projects.map((p) => (
					<DropdownMenuItem key={p.id} asChild>
						<Link
							to="/projects/$projectSlug/architecture"
							params={{ projectSlug: p.slug }}
							className="flex items-center gap-2 py-2"
						>
							<span
								aria-hidden
								className="size-2 rounded-full"
								style={{ backgroundColor: projectColor(p.slug) }}
							/>
							<span className="flex-1 truncate font-mono text-xs">
								{p.slug}
							</span>
							{p.slug === activeSlug && (
								<Check className="size-3.5 text-muted-foreground" />
							)}
						</Link>
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator className="mb-0" />
				<DropdownMenuItem
					asChild
					className="-mx-1 -mb-1 rounded-none rounded-b-md px-3 py-2"
				>
					<Link to="/projects">All projects</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
