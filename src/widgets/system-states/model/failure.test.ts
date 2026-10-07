import { ApiError } from "@/shared/api/http/api-error";

import { failureFor, isRetryable } from "./failure";

const http = (status: number) =>
  new ApiError("http", status, "code", "internal detail", {}, "req-1");

describe("failureFor", () => {
  it("maps transport failures to offline", () => {
    expect(failureFor(new ApiError("network", 0, "network_error", "x", {}, null))).toBe("offline");
    expect(failureFor(new ApiError("timeout", 0, "timeout", "x", {}, null))).toBe("offline");
  });

  it("maps API statuses", () => {
    expect(failureFor(http(401))).toBe("unauthorized");
    expect(failureFor(http(403))).toBe("forbidden");
    expect(failureFor(http(503))).toBe("unavailable");
    expect(failureFor(http(500))).toBe("unexpected");
    expect(failureFor(new Error("boom"))).toBe("unexpected");
  });

  it("does not retry where it cannot help", () => {
    expect(isRetryable("forbidden")).toBe(false);
    expect(isRetryable("offline")).toBe(true);
  });
});
