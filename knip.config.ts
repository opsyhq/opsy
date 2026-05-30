const config = {
	includeEntryExports: true,
	ignoreDependencies: [
		// Loaded dynamically by Pino's transport resolver.
		"pino-pretty",
	],
	ignoreIssues: {
		"apps/api/drizzle.config.ts": ["files", "exports", "types"],
		"apps/api/src/nitro.ts": ["files", "exports", "types"],
		"apps/thinking-block-ui/src/components/ui/**": [
			"files",
			"exports",
			"types",
		],
		"apps/web/src/components/ui/**": ["files", "exports", "types"],
		"**/*.generated.ts": ["files", "exports", "types"],
	},
	workspaces: {
		"apps/api": {
			drizzle: false,
		},
	},
}

export default config
