import { z } from "zod";
export const UuidSchema = z.string().uuid();
export const IsoTimestampSchema = z.string().datetime({ offset: true });
export const SlugSchema = z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9_-]*$/, "Use lowercase letters, numbers, '_' or '-', starting with alphanumeric");
export const NullableStringSchema = z.string().min(1).nullable();
export const JsonValueSchema = z.lazy(() => z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
]));
export const JsonObjectSchema = z.record(z.string(), JsonValueSchema);
export function sortJson(value) {
    if (Array.isArray(value)) {
        return value.map(sortJson);
    }
    if (value && typeof value === "object") {
        const entries = Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, child]) => [key, sortJson(child)]);
        const sorted = {};
        for (const [key, child] of entries) {
            sorted[key] = child;
        }
        return sorted;
    }
    return value;
}
export function canonicalJsonStringify(value) {
    return JSON.stringify(sortJson(value));
}
//# sourceMappingURL=common.js.map