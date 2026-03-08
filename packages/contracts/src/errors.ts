import { z } from "zod";

export const ErrorCodeEnum = z.enum([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "CONFLICT",
  "PLAN_LIMIT_REACHED",
  "FEATURE_NOT_AVAILABLE",
  "BILLING_NOT_CONFIGURED",
  "UNRESOLVED_REF",
  "REF_CYCLE",
  "PROVIDER_NOT_BOUND",
  "APPROVAL_REQUIRED",
  "APPROVAL_REJECTED",
  "RUN_FAILED",
  "LOCK_CONFLICT",
  "NOT_IMPLEMENTED",
  "INTERNAL_ERROR",
]);

export type ErrorCode = z.infer<typeof ErrorCodeEnum>;

export const ErrorResponseSchema = z.object({
  isError: z.literal(true),
  code: ErrorCodeEnum,
  message: z.string().min(1),
  retryable: z.boolean().default(false),
  details: z.unknown().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
