import type { ErrorResponse } from "@/shared/api/generated/model";

/** Field name to messages, from a backend `validation_error` response. */
export type FieldErrors = Record<string, string[]>;

/**
 * Where a failure happened:
 * - "http": the API answered with a non-2xx status (code from the backend envelope),
 * - "network": no response (offline, DNS, refused, TLS failure),
 * - "timeout": no response within the transport timeout.
 */
export type ApiErrorKind = "http" | "network" | "timeout";

/**
 * The one error type thrown by the API transport.
 *
 * Mirrors the backend error envelope (`ErrorResponse`). Branch on `code`,
 * never on `message`: messages are English, for developers, and may change.
 * Unknown codes must be handled according to `status`.
 */
export class ApiError extends Error {
  override readonly name = "ApiError";

  constructor(
    readonly kind: ApiErrorKind,
    /** HTTP status, or 0 when no response was received. */
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown>,
    /** Backend `x-request-id`, for support and log correlation. */
    readonly requestId: string | null,
    /** Seconds from the `retry-after` header (`rate_limited`), when the API sent one. */
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }

  /** Builds an ApiError from a response body that may or may not be the envelope. */
  static fromResponse(
    status: number,
    body: unknown,
    requestId: string | null,
    retryAfter: string | null = null,
  ): ApiError {
    const retryAfterSeconds = parseRetryAfter(retryAfter);
    if (isErrorResponse(body)) {
      const { code, message, details, request_id } = body.error;
      return new ApiError(
        "http",
        status,
        code,
        message,
        details,
        request_id ?? requestId,
        retryAfterSeconds,
      );
    }
    return new ApiError(
      "http",
      status,
      "unexpected_response",
      `Unexpected API response (HTTP ${status})`,
      {},
      requestId,
      retryAfterSeconds,
    );
  }

  static network(cause: unknown): ApiError {
    const error = new ApiError(
      "network",
      0,
      "network_error",
      "The API could not be reached",
      {},
      null,
    );
    error.cause = cause;
    return error;
  }

  static timeout(timeoutMs: number): ApiError {
    return new ApiError(
      "timeout",
      0,
      "timeout",
      `No API response within ${timeoutMs} ms`,
      {},
      null,
    );
  }

  /** Field errors when this is a `validation_error`, otherwise an empty object. */
  get fieldErrors(): FieldErrors {
    if (this.code !== "validation_error") return {};
    const fields = this.details.fields;
    if (typeof fields !== "object" || fields === null) return {};

    return Object.fromEntries(
      Object.entries(fields).filter(
        (entry): entry is [string, string[]] =>
          Array.isArray(entry[1]) && entry[1].every((message) => typeof message === "string"),
      ),
    );
  }

  /**
   * Machine-readable field codes (`required`, `too_young`, …) when this is a
   * `validation_error`, otherwise an empty object. Branch on these, never on
   * the messages.
   */
  get fieldCodes(): FieldErrors {
    if (this.code !== "validation_error") return {};
    const codes = this.details.field_codes;
    if (typeof codes !== "object" || codes === null) return {};

    return Object.fromEntries(
      Object.entries(codes).filter(
        (entry): entry is [string, string[]] =>
          Array.isArray(entry[1]) && entry[1].every((code) => typeof code === "string"),
      ),
    );
  }
}

/** The delay-seconds form of `retry-after` (the API never sends an HTTP date). */
function parseRetryAfter(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value.trim())) return null;
  return Number(value.trim());
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function isErrorResponse(body: unknown): body is ErrorResponse {
  if (typeof body !== "object" || body === null || !("error" in body)) return false;
  const error = (body as { error: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as Record<string, unknown>).code === "string" &&
    typeof (error as Record<string, unknown>).message === "string"
  );
}
