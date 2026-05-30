import { z } from "zod"

declare module "zod" {
	// Augment ZodType — params must exactly match zod v4's interface defaults.
	interface ZodType<out Output = unknown, out Input = unknown> {
		widget(name: string, opts?: Record<string, unknown>): this
	}
}

;(z.ZodType.prototype as unknown as { widget: unknown }).widget = function (
	this: z.ZodType,
	name: string,
	opts?: Record<string, unknown>,
) {
	;(this._def as { _opsyWidget?: unknown })._opsyWidget = { name, opts }
	return this
}

type WidgetAnnotation = { name: string; opts?: Record<string, unknown> }
export function getWidget(schema: z.ZodType): WidgetAnnotation | undefined {
	return (schema._def as { _opsyWidget?: WidgetAnnotation })._opsyWidget
}
