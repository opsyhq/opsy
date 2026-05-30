import pino from "pino"

// Read log level and environment directly from process.env with the same
// defaults as the Zod schema in lib/env.ts — this avoids importing env here
// so that service modules can be loaded in unit tests without a .env file.
const LOG_LEVEL = (process.env.LOG_LEVEL ?? "info") as pino.LevelWithSilent
const NODE_ENV = process.env.NODE_ENV ?? "development"

export const baseLogger = pino({
	level: LOG_LEVEL,
	...(NODE_ENV !== "production" && {
		transport: { target: "pino-pretty" },
	}),
})
