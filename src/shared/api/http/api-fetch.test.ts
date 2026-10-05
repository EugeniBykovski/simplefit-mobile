import { getHealth } from "@/shared/api/generated/endpoints/system/system";
import { jsonResponse, mockFetch } from "@/test/render";

import { ApiError } from "./api-error";
import { apiFetch, apiUrl } from "./api-fetch";

describe("apiUrl", () => {
  it("resolves paths against EXPO_PUBLIC_API_URL", () => {
    expect(apiUrl("/api/health")).toBe("http://api.test/api/health");
    expect(apiUrl("api/health")).toBe("http://api.test/api/health");
  });
});

describe("apiFetch", () => {
  it("sends JSON and resolves with the parsed body", async () => {
    const fetchMock = mockFetch(jest.fn().mockResolvedValue(jsonResponse({ ok: true })));

    await expect(apiFetch("/api/thing", { method: "POST", body: "{}" })).resolves.toEqual({
      ok: true,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("http://api.test/api/thing");
    expect(init.method).toBe("POST");
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("content-type")).toBe("application/json");
    expect(init.signal).toBeDefined();
  });

  it("throws ApiError carrying the backend envelope for HTTP errors", async () => {
    mockFetch(
      jest.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: "not_found",
              message: "Not found",
              details: {},
              request_id: "req-404",
            },
          },
          { status: 404 },
        ),
      ),
    );

    await expect(apiFetch("/api/v1/missing")).rejects.toMatchObject({
      kind: "http",
      status: 404,
      code: "not_found",
      requestId: "req-404",
    });
  });

  it("normalizes network failures", async () => {
    mockFetch(jest.fn().mockRejectedValue(new TypeError("Network request failed")));

    const error = await apiFetch("/api/health").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: "network", code: "network_error", status: 0 });
  });

  it("times out requests that never answer", async () => {
    mockFetch(
      jest.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
          }),
      ),
    );

    await expect(apiFetch("/api/health", { timeoutMs: 20 })).rejects.toMatchObject({
      kind: "timeout",
      code: "timeout",
    });
  });

  it("rethrows caller cancellations unchanged (TanStack Query cancellation)", async () => {
    const abortError = new Error("Aborted");
    mockFetch(
      jest.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(abortError));
          }),
      ),
    );
    const controller = new AbortController();

    const request = apiFetch("/api/health", { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toBe(abortError);
  });
});

describe("generated client", () => {
  it("calls the backend contract through apiFetch", async () => {
    const fetchMock = mockFetch(
      jest.fn().mockResolvedValue(jsonResponse({ status: "ok", service: "simplefit-api" })),
    );

    await expect(getHealth()).resolves.toEqual({ status: "ok", service: "simplefit-api" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/health",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
