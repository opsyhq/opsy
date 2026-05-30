import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": new URL("./src", import.meta.url).pathname,
		},
	},
	server: {
		port: 3001,
		proxy: {
			"/api/auth": {
				target: "http://localhost:4000",
			},
			"/api": {
				target: "http://localhost:4000",
				rewrite: (path) => path.replace(/^\/api/, ""),
			},
		},
	},
})
