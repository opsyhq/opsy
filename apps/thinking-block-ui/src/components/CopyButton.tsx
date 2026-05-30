import { CheckIcon, CopyIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip"

type CopyButtonProps = {
	value: string
	label: string
	className?: string
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
	const [copied, setCopied] = useState(false)

	useEffect(() => {
		if (!copied) return
		const timeout = window.setTimeout(() => setCopied(false), 1200)
		return () => window.clearTimeout(timeout)
	}, [copied])

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className={className}
					aria-label={label}
					onClick={(event) => {
						event.preventDefault()
						event.stopPropagation()
						void navigator.clipboard
							.writeText(value)
							.then(() => setCopied(true))
					}}
				>
					{copied ? <CheckIcon /> : <CopyIcon />}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{copied ? "Copied" : label}</TooltipContent>
		</Tooltip>
	)
}
