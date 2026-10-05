// SimpleFit commit message convention (shared with simplefit-platform):
//
//   <type>: <JIRA-ID> - <description>
//   feat: SF-12 - add mobile platform foundation
//
// Dependency-free so commitlint.config.js and the tests share one source.

const COMMIT_TYPES = [
  "feat",
  "fix",
  "refactor",
  "perf",
  "test",
  "docs",
  "build",
  "ci",
  "chore",
  "revert",
];

const JIRA_KEY_PATTERN = /SF-[0-9]+/;

const COMMIT_HEADER_PATTERN = new RegExp(
  `^(${COMMIT_TYPES.join("|")}): (${JIRA_KEY_PATTERN.source}) - (\\S.*)$`,
);

const COMMIT_FORMAT_HELP =
  "Expected '<type>: SF-<n> - <description>', e.g. 'feat: SF-12 - add mobile platform foundation'. " +
  `Allowed types: ${COMMIT_TYPES.join(", ")}.`;

/** Validates a commit header (first line). Returns [valid, message]. */
function validateCommitHeader(header) {
  const value = (header ?? "").trim();

  if (!JIRA_KEY_PATTERN.test(value)) {
    return [false, `Commit header must contain a Jira issue key (SF-<n>). ${COMMIT_FORMAT_HELP}`];
  }
  if (!COMMIT_HEADER_PATTERN.test(value)) {
    return [false, `Commit header does not match the convention. ${COMMIT_FORMAT_HELP}`];
  }
  return [true, ""];
}

module.exports = {
  COMMIT_TYPES,
  JIRA_KEY_PATTERN,
  COMMIT_HEADER_PATTERN,
  COMMIT_FORMAT_HELP,
  validateCommitHeader,
};
