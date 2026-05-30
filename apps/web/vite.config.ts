import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
	plugins: [
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
			quoteStyle: "double",
			routeFileIgnorePattern: "\\.(machine|form|test)\\.tsx?$",
		}),
		react(),
		tailwindcss(),
	],
	resolve: {
		alias: {
			"@": new URL("./src", import.meta.url).pathname,
		},
	},
	build: {
		rollupOptions: {
			output: {
				// lucide-react ships one module per icon, all calling a shared
				// createLucideIcon factory. Rolldown's auto-splitting put the
				// factory in the entry chunk while emitting each icon as its own
				// chunk that imports the factory back from the entry — a circular
				// static import where the icon chunk invokes the factory at
				// module-eval before the entry binding is initialized
				// ("TypeError: t is not a function" -> blank page). Keeping all of
				// lucide-react in one chunk colocates the factory with its icons
				// and removes the cycle.
				manualChunks(id) {
					if (id.includes("/node_modules/lucide-react/")) return "lucide"
				},
			},
		},
	},
	server: {
		port: 3000,
		proxy: {
			"/api": {
				target: "http://localhost:4000",
				rewrite: (path) => path.replace(/^\/api/, ""),
			},
		},
	},
})
