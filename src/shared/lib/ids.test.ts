import { isResourceId } from "./ids";

describe("isResourceId", () => {
  it("accepts UUIDs only", () => {
    expect(isResourceId("8a6e0804-2bd0-4672-b79d-d97027f9071b")).toBe(true);
    expect(isResourceId("8A6E0804-2BD0-4672-B79D-D97027F9071B")).toBe(true);
    for (const value of [
      "",
      "rel-1",
      "8a6e0804-2bd0-4672-b79d-d97027f9071b/end",
      "../me",
      undefined,
      ["x"],
    ]) {
      expect(isResourceId(value)).toBe(false);
    }
  });
});
