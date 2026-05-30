import { Loader2 } from "lucide-react"
import { ProviderLogo } from "@/components/ProviderLogo"
import type {
	ProviderMetaRecord,
	ThinkingBlockArtifactStatus,
	TypeIconLookup,
} from "@/lib/providerReactQuery"
import { cn } from "@/lib/utils"

const WRAPPER_CLASSES = {
	sm: "size-5",
	md: "size-6",
	lg: "size-9",
} as const

const SPINNER_CLASSES = {
	sm: "size-2",
	md: "size-2.5",
	lg: "size-3",
} as const

type ResourceTypeIconSize = keyof typeof WRAPPER_CLASSES

function isGenerating(status: ThinkingBlockArtifactStatus | null | undefined) {
	return status === "pending" || status === "running"
}

function ResourceTypeIcon({
	provider,
	icon,
	iconName,
	iconUrl,
	status,
	loading = false,
	size = "md",
	className,
	spinnerSurfaceClassName = "bg-background",
	spinnerClassName = "text-muted-foreground",
}: {
	provider: ProviderMetaRecord
	icon?: TypeIconLookup | null
	iconName?: string
	iconUrl?: string
	status?: ThinkingBlockArtifactStatus | null
	loading?: boolean
	size?: ResourceTypeIconSize
	className?: string
	spinnerSurfaceClassName?: string
	spinnerClassName?: string
}) {
	const generatedUrl =
		icon?.status === "ready" && icon.data?.url ? icon.data.url : undefined
	const effectiveStatus = icon?.status ?? status
	const effectiveIconUrl = generatedUrl ?? iconUrl
	const showSpinner = loading || isGenerating(effectiveStatus)

	return (
		<span
			className={cn(
				"relative inline-flex shrink-0 items-center justify-center",
				WRAPPER_CLASSES[size],
				className,
			)}
		>
			<ProviderLogo
				provider={provider}
				iconName={iconName}
				iconUrl={effectiveIconUrl}
				size={size}
			/>
			{showSpinner && (
				<span
					className={cn(
						"absolute -right-1 -bottom-1 rounded-full p-0.5",
						spinnerSurfaceClassName,
					)}
				>
					<Loader2
						className={cn(
							"animate-spin",
							SPINNER_CLASSES[size],
							spinnerClassName,
						)}
					/>
				</span>
			)}
		</span>
	)
}

export function ResourceTypeIconForType({
	provider,
	icon,
	iconName,
	iconUrl,
	status,
	loading = false,
	...iconProps
}: {
	provider: ProviderMetaRecord
	type?: string | null
	icon?: TypeIconLookup | null
	iconName?: string
	iconUrl?: string
	status?: ThinkingBlockArtifactStatus | null
	loading?: boolean
	size?: ResourceTypeIconSize
	className?: string
	spinnerSurfaceClassName?: string
	spinnerClassName?: string
}) {
	return (
		<ResourceTypeIcon
			{...iconProps}
			provider={provider}
			icon={icon}
			iconName={iconName}
			iconUrl={iconUrl}
			status={icon?.status ?? status}
			loading={loading}
		/>
	)
}
