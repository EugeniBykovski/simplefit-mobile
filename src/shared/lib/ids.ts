/*
 * Resource ids in API paths. The generated client puts a path parameter into
 * the URL as it is (no encoding), and every SimpleFit resource id is a UUID
 * (OpenAPI `format: uuid`). A route parameter that is not one never reaches
 * the network: it could otherwise address another endpoint (`""`, `a/end`).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether `value` can be sent as a resource id in an API path. */
export const isResourceId = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);
