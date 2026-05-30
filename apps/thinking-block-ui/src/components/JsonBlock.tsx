import { ChevronRightIcon } from "lucide-react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { CopyButton } from "@/components/CopyButton"
import { jsonText } from "@/lib/format"
import { cn } from "@/lib/utils"

type JsonBlockProps = {
	title: string
	value: unknown
	defaultOpen?: boolean
	copyLabel?: string
	className?: string
}

export function JsonBlock({
	title,
	value,
	defaultOpen = false,
	copyLabel,
	className,
}: JsonBlockProps) {
	const text = jsonText(value)

	return (
		<details
			className={cn(
				"group rounded-lg border bg-card text-card-foreground",
				className,
			)}
			open={defaultOpen}
		>
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium">
				<span className="flex min-w-0 items-center gap-2">
					<ChevronRightIcon className="size-4 shrink-0 transition-transform group-open:rotate-90" />
					<span className="truncate">{title}</span>
				</span>
				<CopyButton
					value={text}
					label={copyLabel ?? `Copy ${title}`}
					className="size-7 shrink-0"
				/>
			</summary>
			<pre className="max-h-[520px] overflow-auto border-t bg-muted/30 p-3 text-left text-xs leading-relaxed text-foreground">
				{text}
			</pre>
		</details>
	)
}

type MarkdownBlockProps = {
	title: string
	value: unknown
	defaultOpen?: boolean
	copyLabel?: string
	className?: string
}

export function MarkdownBlock({
	title,
	value,
	defaultOpen = false,
	copyLabel,
	className,
}: MarkdownBlockProps) {
	const text = markdownText(value)
	const copyText = jsonText(value)

	return (
		<details
			className={cn(
				"group rounded-lg border bg-card text-card-foreground",
				className,
			)}
			open={defaultOpen}
		>
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium">
				<span className="flex min-w-0 items-center gap-2">
					<ChevronRightIcon className="size-4 shrink-0 transition-transform group-open:rotate-90" />
					<span className="truncate">{title}</span>
				</span>
				<CopyButton
					value={copyText}
					label={copyLabel ?? `Copy ${title}`}
					className="size-7 shrink-0"
				/>
			</summary>
			<div className="markdown-renderer max-h-[520px] overflow-auto border-t bg-muted/30 p-3">
				<Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
			</div>
		</details>
	)
}

function markdownText(value: unknown) {
	if (typeof value === "string") return value.trim().length ? value : "_Empty_"
	return ["```json", jsonText(value), "```"].join("\n")
}
