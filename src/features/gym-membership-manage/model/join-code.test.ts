import { formatJoinCode } from "./join-code";

describe("formatJoinCode (SF-135)", () => {
  it.each([
    ["a", "A"],
    ["abcd", "ABCD"],
    ["abcde", "ABCD-E"],
    ["abcdefgh", "ABCD-EFGH"],
    ["ABCD-EFGH", "ABCD-EFGH"],
    [" abcd efgh ", "ABCD-EFGH"],
    ["ab-cd-ef-gh", "ABCD-EFGH"],
  ])("shows %j as %j", (typed, shown) => {
    expect(formatJoinCode(typed)).toBe(shown);
  });

  it("deleting back over the hyphen isn't fought", () => {
    expect(formatJoinCode("ABCD-")).toBe("ABCD-");
  });

  it("leaves what is too long to be a code for the backend's one answer", () => {
    expect(formatJoinCode("https://example.com/x")).toBe("HTTPS://EXAMPLE.COM/X");
  });
});
