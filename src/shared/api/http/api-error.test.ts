import { ApiError, isApiError } from "./api-error";

describe("ApiError", () => {
  it("normalizes the backend error envelope", () => {
    const error = ApiError.fromResponse(
      422,
      {
        error: {
          code: "validation_error",
          message: "Request validation failed",
          details: { fields: { email: ["has invalid format"], age: "not-a-list" } },
          request_id: "req-1",
        },
      },
      "header-id",
    );

    expect(error).toMatchObject({
      kind: "http",
      status: 422,
      code: "validation_error",
      message: "Request validation failed",
      requestId: "req-1",
    });
    expect(error.fieldErrors).toEqual({ email: ["has invalid format"] });
    expect(isApiError(error)).toBe(true);
  });

  it("normalizes non-envelope bodies with the header request id", () => {
    expect(ApiError.fromResponse(502, "Bad gateway", "edge-1")).toMatchObject({
      kind: "http",
      status: 502,
      code: "unexpected_response",
      requestId: "edge-1",
    });
  });

  it("represents network failures and timeouts without an HTTP status", () => {
    const cause = new TypeError("Network request failed");
    expect(ApiError.network(cause)).toMatchObject({
      kind: "network",
      status: 0,
      code: "network_error",
      cause,
    });
    expect(ApiError.timeout(5000)).toMatchObject({ kind: "timeout", status: 0, code: "timeout" });
  });

  it("has no field errors for other codes", () => {
    expect(
      ApiError.fromResponse(
        409,
        { error: { code: "conflict", message: "x", details: {}, request_id: null } },
        null,
      ).fieldErrors,
    ).toEqual({});
  });
});
