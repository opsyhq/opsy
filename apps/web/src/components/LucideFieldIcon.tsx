import {
	DynamicIcon,
	dynamicIconImports,
	type IconName,
} from "lucide-react/dynamic"
import { cn } from "@/lib/utils"

export function LucideFieldIcon({
	icon,
	className,
}: {
	icon?: string
	className?: string
}) {
	if (!icon?.startsWith("lucide:")) return null
	const name = icon.slice("lucide:".length)
	if (!(name in dynamicIconImports)) return null
	return (
		<DynamicIcon
			name={name as IconName}
			className={cn("size-3.5 shrink-0 text-muted-foreground", className)}
			aria-hidden
			data-field-icon={icon}
			fallback={() => (
				<span
					className={cn("size-3.5 shrink-0", className)}
					aria-hidden
					data-field-icon={icon}
				/>
			)}
		/>
	)
}
