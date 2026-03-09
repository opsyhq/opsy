import { z } from "zod";
export declare const UuidSchema: z.ZodString;
export declare const IsoTimestampSchema: z.ZodString;
export declare const SlugSchema: z.ZodString;
export declare const NullableStringSchema: z.ZodNullable<z.ZodString>;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue;
};
export declare const JsonValueSchema: z.ZodType<JsonValue>;
export type JsonObject = Record<string, JsonValue>;
export declare const JsonObjectSchema: z.ZodRecord<z.ZodString, z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>>;
export declare function sortJson(value: JsonValue): JsonValue;
export declare function canonicalJsonStringify(value: JsonValue): string;
export type Paginated<T> = {
    items: T[];
    nextCursor: string | null;
};
//# sourceMappingURL=common.d.ts.map