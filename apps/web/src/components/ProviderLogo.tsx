import { useState } from "react"
import type { ProviderMetaRecord } from "@/lib/providerReactQuery"
import { cn } from "@/lib/utils"

const SIZE_CLASSES = {
	sm: "size-5 text-[9px]",
	md: "size-6 text-[10px]",
	lg: "size-9 text-xs",
} as const

// Per-type service icon URLs override local provider/logo icon names. On 404 we
// degrade to a colored chip.
export function ProviderLogo({
	provider,
	iconName,
	iconUrl,
	size = "md",
	className,
}: {
	provider: ProviderMetaRecord
	iconName?: string
	iconUrl?: string
	size?: keyof typeof SIZE_CLASSES
	className?: string
}) {
	const name = iconName ?? provider.logo
	const src =
		iconUrl ?? (name ? `/icons/${provider.id}/${name}.svg` : undefined)
	// Track which src failed, not a boolean. When src changes, we naturally
	// retry without an effect.
	const [brokenSrc, setBrokenSrc] = useState<string | null>(null)

	if (src && brokenSrc !== src) {
		return (
			<img
				src={src}
				alt={provider.name}
				title={provider.name}
				className={cn(
					"inline-block shrink-0 rounded-[4px] object-contain",
					SIZE_CLASSES[size],
					className,
				)}
				onError={() => setBrokenSrc(src)}
			/>
		)
	}

	return (
		<span
			role="img"
			aria-label={provider.name}
			title={provider.name}
			className={cn(
				"inline-flex shrink-0 items-center justify-center rounded font-bold uppercase tracking-tight text-white",
				SIZE_CLASSES[size],
				className,
			)}
			style={{ backgroundColor: provider.color }}
		>
			{provider.short.slice(0, 3)}
		</span>
	)
}
