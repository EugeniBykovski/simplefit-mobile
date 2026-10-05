/**
 * Pre-commit: fast checks on staged files only. Typecheck, tests and Expo
 * checks run in `pnpm quality` and CI, not here.
 *
 * @type {import("lint-staged").Configuration}
 */
module.exports = {
  "*.{js,mjs,cjs,ts,mts,cts,tsx}": [
    "eslint --max-warnings=0 --no-warn-ignored --fix",
    "prettier --write --ignore-unknown",
  ],
  "*.{json,md,yml,yaml}": "prettier --write --ignore-unknown",
};
