import { ApiError } from "./http/api-error";
import { makeQueryClient, shouldRetry } from "./query-client";

const httpError = (status: number) => new ApiError("http", status, "code", "message", {}, null);

describe("shouldRetry", () => {
  it("never retries client errors, including auth errors", () => {
    for (const status of [400, 401, 403, 404, 422, 429]) {
      expect(shouldRetry(0, httpError(status))).toBe(false);
    }
  });

  it("retries server errors, network failures and timeouts a bounded number of times", () => {
    expect(shouldRetry(0, httpError(503))).toBe(true);
    expect(shouldRetry(1, ApiError.network(new TypeError("offline")))).toBe(true);
    expect(shouldRetry(1, ApiError.timeout(1000))).toBe(true);
    expect(shouldRetry(2, httpError(503))).toBe(false);
  });
});

describe("makeQueryClient", () => {
  it("never retries mutations automatically", () => {
    expect(makeQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });
});
