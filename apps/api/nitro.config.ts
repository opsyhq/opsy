import { defineConfig } from "nitro"

export default defineConfig({
	preset: "node-server",
	devServer: {
		runner: "bun-process",
	},
	modules: ["workflow/nitro"],
	traceDeps: ["@workflow/world-postgres*", "dotenv*", "undici*"],
	routes: {
		"/**": "./src/nitro.ts",
	},
})
