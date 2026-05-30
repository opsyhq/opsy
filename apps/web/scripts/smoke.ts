// Post-build smoke test: serves the built SPA and asserts it actually mounts
// in a real browser. Guards against builds that compile cleanly but fail at
// module-eval (e.g. a bundler chunk-ordering cycle), which `vite build`
// reports as success but ships a white screen.
//
// Fails the build on:
//   - any uncaught page exception (pageerror), or
//   - #root never gaining children (React never mounted).
// Deliberately does NOT fail on console.error / failed network requests:
// those depend on the API origin + CORS and are not build defects.

import { spawn } from "node:child_process"
import { type Browser, chromium } from "playwright"

const HOST = "127.0.0.1"
const PORT = 4173
const URL = `http://${HOST}:${PORT}/`

function startPreview() {
	const proc = spawn(
		"bunx",
		["vite", "preview", "--host", HOST, "--port", String(PORT), "--strictPort"],
		{ stdio: ["ignore", "pipe", "pipe"] },
	)
	proc.stdout.on("data", (d) => process.stdout.write(`[preview] ${d}`))
	proc.stderr.on("data", (d) => process.stderr.write(`[preview] ${d}`))
	return proc
}

async function waitForServer(timeoutMs = 30_000) {
	const deadline = Date.now() + timeoutMs
	while (Date.now() < deadline) {
		try {
			const res = await fetch(URL)
			if (res.ok) return
		} catch {
			// not up yet
		}
		await new Promise((r) => setTimeout(r, 300))
	}
	throw new Error(
		`vite preview did not come up at ${URL} within ${timeoutMs}ms`,
	)
}

const preview = startPreview()
let browser: Browser | undefined
let exitCode = 0

try {
	await waitForServer()

	browser = await chromium.launch()
	const page = await browser.newPage()

	const pageErrors: string[] = []
	page.on("pageerror", (err) => pageErrors.push(err.message))

	await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30_000 })

	let mounted = true
	try {
		await page.waitForFunction(
			() => (document.getElementById("root")?.childElementCount ?? 0) > 0,
			{ timeout: 15_000 },
		)
	} catch {
		mounted = false
	}

	if (pageErrors.length > 0) {
		exitCode = 1
		console.error(`\n✗ smoke: uncaught page exception(s) at boot:`)
		for (const m of pageErrors) console.error(`  - ${m}`)
	}
	if (!mounted) {
		exitCode = 1
		console.error(`\n✗ smoke: #root never mounted (blank page)`)
	}
	if (exitCode === 0) {
		console.log(`\n✓ smoke: SPA mounted cleanly at ${URL}`)
	}
} catch (err) {
	exitCode = 1
	console.error(`\n✗ smoke: ${err instanceof Error ? err.message : err}`)
} finally {
	await browser?.close()
	preview.kill("SIGTERM")
}

process.exit(exitCode)
