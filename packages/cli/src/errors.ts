import type { ErrorCode, ErrorResponse } from "@opsy/contracts";

export const EXIT_CODE = {
  OK: 0,
  FAILURE: 1,
  USAGE: 2,
  UNAUTHENTICATED: 3,
  FORBIDDEN: 4,
  NOT_FOUND: 5,
  CONFLICT: 6,
  VALIDATION: 7,
} as const;

export type ExitCode = (typeof EXIT_CODE)[keyof typeof EXIT_CODE];

export class CliError extends Error {
  readonly exitCode: ExitCode;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, options?: { exitCode?: ExitCode; code?: string; details?: unknown }) {
    super(message);
    this.name = "CliError";
    this.exitCode = options?.exitCode ?? EXIT_CODE.FAILURE;
    this.code = options?.code ?? "CLI_ERROR";
    this.details = options?.details;
  }
}

export class UsageError extends CliError {
  readonly command?: string;

  constructor(message: string, options?: { details?: unknown; command?: string }) {
    super(message, { exitCode: EXIT_CODE.USAGE, code: "USAGE_ERROR", details: options?.details });
    this.name = "UsageError";
    this.command = options?.command;
  }
}

export class ApiError extends CliError {
  readonly status: number;
  readonly apiCode: ErrorCode | "HTTP_ERROR";
  readonly retryable: boolean;

  constructor(status: number, body: ErrorResponse | { message: string }) {
    const message = body.message;
    const apiCode = "code" in body ? body.code : "HTTP_ERROR";
    super(message, {
      exitCode: mapApiErrorToExitCode(apiCode),
      code: apiCode,
      details: "details" in body ? body.details : undefined,
    });
    this.name = "ApiError";
    this.status = status;
    this.apiCode = apiCode;
    this.retryable = "retryable" in body ? body.retryable : false;
  }
}

export function mapApiErrorToExitCode(code: ErrorCode | "HTTP_ERROR"): ExitCode {
  switch (code) {
    case "UNAUTHENTICATED":
      return EXIT_CODE.UNAUTHENTICATED;
    case "FORBIDDEN":
      return EXIT_CODE.FORBIDDEN;
    case "NOT_FOUND":
      return EXIT_CODE.NOT_FOUND;
    case "CONFLICT":
      return EXIT_CODE.CONFLICT;
    case "VALIDATION_ERROR":
      return EXIT_CODE.VALIDATION;
    default:
      return EXIT_CODE.FAILURE;
  }
}

export function toErrorPayload(error: unknown): Record<string, unknown> {
  if (error instanceof ApiError) {
    return {
      isError: true,
      code: error.apiCode,
      message: error.message,
      retryable: error.retryable,
      details: error.details,
      exitCode: error.exitCode,
      status: error.status,
    };
  }

  if (error instanceof CliError) {
    return {
      isError: true,
      code: error.code,
      message: error.message,
      details: error.details,
      exitCode: error.exitCode,
    };
  }

  return {
    isError: true,
    code: "INTERNAL_ERROR",
    message: error instanceof Error ? error.message : "Unknown error.",
    exitCode: EXIT_CODE.FAILURE,
  };
}
