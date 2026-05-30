import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export function getUserInitials(name?: string, email?: string): string {
	if (name) {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2)
	}
	return email?.slice(0, 2).toUpperCase() ?? "?"
}

export function relativeTime(date: string | Date): string {
	const d = new Date(date)
	const now = new Date()
	const diffMs = now.getTime() - d.getTime()
	const diffSec = Math.floor(diffMs / 1000)
	if (diffSec < 60) return "just now"
	const diffMin = Math.floor(diffSec / 60)
	if (diffMin < 60) return `${diffMin}m ago`
	const diffHr = Math.floor(diffMin / 60)
	if (diffHr < 24) return `${diffHr}h ago`
	const diffDay = Math.floor(diffHr / 24)
	if (diffDay < 30) return `${diffDay}d ago`
	return d.toLocaleDateString()
}
