import { Box, Pencil, Zap } from "lucide-react"
import type { ComponentType, ReactNode } from "react"
import {
	type ResourceDetailSectionTab,
	sectionTabIcon,
} from "@/components/resource-detail/ResourceDetail.logic"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ResourceDetailFrame({
	variant = "page",
	back,
	title,
	subtitle,
	badges,
	headerActions,
	hideTitle = false,
	sectionTabs,
	activeTab,
	onTabChange,
	configurationSelected,
	canEditConfiguration = false,
	onEditConfiguration,
	configuration,
	operations,
	operationDetail,
	footer,
}: {
	variant?: "page" | "sheet"
	back?: ReactNode
	title: ReactNode
	subtitle?: ReactNode
	badges?: ReactNode
	headerActions?: ReactNode
	hideTitle?: boolean
	sectionTabs: ResourceDetailSectionTab[]
	activeTab: string
	onTabChange: (value: string) => void
	configurationSelected: boolean
	canEditConfiguration?: boolean
	onEditConfiguration?: () => void
	configuration: ReactNode
	operations: ReactNode
	operationDetail?: ReactNode
	footer?: ReactNode
}) {
	const titleBlock = !hideTitle && (
		<div>
			{back}
			<div className="flex flex-wrap items-center gap-3">
				<h1 className="font-mono text-lg font-medium tracking-tight">
					{title}
				</h1>
				{badges}
				{headerActions && (
					<div className="ml-auto flex items-center gap-2">{headerActions}</div>
				)}
			</div>
			{subtitle && (
				<p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
			)}
		</div>
	)

	const tabsRow = (
		<div className="flex items-start gap-2">
			<div className="flex flex-1 flex-wrap items-center gap-2">
				{sectionTabs.length > 0 ? (
					sectionTabs.map(({ value, section }) => (
						<TabPill
							key={value}
							active={activeTab === value}
							onClick={() => onTabChange(value)}
							icon={sectionTabIcon(section.title)}
							label={section.title}
						/>
					))
				) : (
					<TabPill
						active={activeTab === "configuration"}
						onClick={() => onTabChange("configuration")}
						icon={Box}
						label="Configuration"
					/>
				)}
				<TabPill
					active={activeTab === "operations"}
					onClick={() => onTabChange("operations")}
					icon={Zap}
					label="Operations"
				/>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				{configurationSelected && canEditConfiguration && (
					<Button
						size="icon-xs"
						variant="outline"
						className="size-7 rounded-md"
						onClick={onEditConfiguration}
						aria-label="Edit configuration"
						title="Edit"
					>
						<Pencil className="size-3.5 stroke-[1.5]" />
					</Button>
				)}
				{hideTitle && headerActions}
			</div>
		</div>
	)

	const body = (
		<div>
			{configurationSelected && configuration}
			{activeTab === "operations" && operations}
		</div>
	)

	if (variant === "sheet") {
		return (
			<div className="flex h-full flex-col">
				<div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
					{titleBlock}
					{tabsRow}
					{body}
				</div>
				{footer ? (
					<div className="flex h-12 shrink-0 items-center justify-between gap-2 border-t border-border px-4">
						{footer}
					</div>
				) : null}
				{operationDetail}
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6">
			{titleBlock}
			{tabsRow}
			{body}
			{operationDetail}
		</div>
	)
}

function TabPill({
	active,
	onClick,
	icon: Icon,
	label,
}: {
	active: boolean
	onClick: () => void
	icon: ComponentType<{ className?: string }>
	label: string
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-normal transition-colors focus-visible:outline-none focus-visible:ring-0",
				active
					? "border-border text-foreground"
					: "border-border text-muted-foreground hover:text-foreground",
			)}
		>
			<Icon className="size-3.5" />
			{label}
		</button>
	)
}
