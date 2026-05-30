export function respond(body: unknown, ok = true, status = 200): Response {
	return {
		ok,
		status,
		json: () => Promise.resolve(body),
		text: () =>
			Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
	} as unknown as Response
}
