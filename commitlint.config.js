const {
  COMMIT_HEADER_PATTERN,
  COMMIT_TYPES,
  validateCommitHeader,
} = require("./scripts/commit-convention");

/**
 * Enforces `<type>: SF-<n> - <description>` (same contract as
 * simplefit-platform). commitlint's conventional preset cannot require a Jira
 * key, so the header is parsed with our own pattern and checked by the custom
 * `simplefit-header` rule. Merge commits and git's default revert messages are
 * ignored by commitlint's default ignores.
 *
 * @type {import("@commitlint/types").UserConfig}
 */
module.exports = {
  parserPreset: {
    parserOpts: {
      headerPattern: COMMIT_HEADER_PATTERN,
      headerCorrespondence: ["type", "ticket", "subject"],
    },
  },
  plugins: [{ rules: { "simplefit-header": (parsed) => validateCommitHeader(parsed.header) } }],
  rules: {
    "simplefit-header": [2, "always"],
    "type-enum": [2, "always", COMMIT_TYPES],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [2, "always"],
    "footer-leading-blank": [2, "always"],
  },
  helpUrl: "docs/architecture/README.md#git-and-jira-conventions",
};
