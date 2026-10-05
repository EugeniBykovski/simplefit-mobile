const { validateCommitHeader } = require("./commit-convention");

describe("validateCommitHeader", () => {
  it.each([
    "feat: SF-12 - add mobile platform foundation",
    "fix: SF-28 - prevent duplicate training request",
    "refactor: SF-41 - extract session mapper",
    "test: SF-12 - cover locale resolution",
    "docs: SF-12 - document mobile architecture",
    "chore: SF-12 - bootstrap mobile platform foundation",
    "chore: SF-12 - test commit convention",
  ])("accepts %s", (header) => {
    expect(validateCommitHeader(header)).toEqual([true, ""]);
  });

  it.each([
    ["feat: add mobile foundation", /Jira issue key/],
    ["feat: SF-12 add mobile foundation", /does not match/],
    ["feature: SF-12 - add mobile foundation", /does not match/],
    ["feat(mobile): SF-12 - add mobile foundation", /does not match/],
    ["feat: sf-12 - add mobile foundation", /Jira issue key/],
    ["feat: SF-12 - ", /does not match/],
    ["SF-12 - add mobile foundation", /does not match/],
    ["revert: SF-40 - revert reminder change", /does not match/],
  ])("rejects %s", (header, message) => {
    const [valid, reason] = validateCommitHeader(header);
    expect(valid).toBe(false);
    expect(reason).toMatch(message);
  });
});
