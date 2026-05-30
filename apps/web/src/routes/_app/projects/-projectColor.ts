const PROJECT_PALETTE = ["#50B2C0", "#08A045", "#EB8F1E", "#9E4BE2"] as const

export function projectColor(slug: string): string {
	let hash = 0
	for (let i = 0; i < slug.length; i++) {
		hash = (hash * 31 + slug.charCodeAt(i)) | 0
	}
	return PROJECT_PALETTE[Math.abs(hash) % PROJECT_PALETTE.length]
}
