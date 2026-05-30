import type * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base shadow-none transition-[color,border-color,background-color] outline-none placeholder:font-light placeholder:text-muted-foreground placeholder:opacity-60 focus-visible:border-input focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-transparent dark:aria-invalid:ring-destructive/40",
				className,
			)}
			{...props}
		/>
	)
}

export { Textarea }
