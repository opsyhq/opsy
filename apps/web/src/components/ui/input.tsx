import type * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1 text-sm font-light shadow-none transition-[color,border-color,background-color] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:font-light placeholder:text-muted-foreground placeholder:opacity-70 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-transparent",
				"focus-visible:border-input focus-visible:ring-0",
				"aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
				className,
			)}
			{...props}
		/>
	)
}

export { Input }
