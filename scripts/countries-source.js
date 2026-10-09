/**
 * Codes that are not officially assigned countries, by class (the web
 * client's list): exceptionally reserved, transitionally reserved, and
 * withdrawn ISO 3166-3 codes that were not reassigned.
 */
const NOT_ASSIGNED = new Set(
  (
    "AC CP CQ DG EA EU EZ FX IC SU TA UK UN " +
    "BU CS NT TP YU ZR " +
    "AN CT DD DY FQ HV JT MI NH NQ PC PU PZ RH VD WK YD"
  ).split(" "),
);

/** The user-assigned code ranges of ISO 3166-1: never a country. */
const isUserAssigned = (code) =>
  code === "AA" ||
  code === "ZZ" ||
  code.startsWith("X") ||
  (code.charAt(0) === "Q" && code.charAt(1) >= "M");

const LETTERS = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index));

/** The officially assigned ISO 3166-1 alpha-2 codes CLDR names, uppercase, sorted. */
function assignedCountryCodes() {
  const names = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
  return LETTERS.flatMap((first) => LETTERS.map((second) => `${first}${second}`)).filter(
    (code) => !NOT_ASSIGNED.has(code) && !isUserAssigned(code) && names.of(code) !== undefined,
  );
}

/** Each full app locale's names (es-MX falls back to es). */
function localizedCountryNames(codes) {
  const registry = require("../src/shared/i18n/locales.json");
  const locales = Object.entries(registry)
    .filter(([, entry]) => entry.fallback === undefined)
    .map(([locale]) => locale);
  return Object.fromEntries(
    locales.map((locale) => {
      const names = new Intl.DisplayNames([locale], { type: "region", fallback: "code" });
      return [locale, Object.fromEntries(codes.map((code) => [code, names.of(code)]))];
    }),
  );
}

module.exports = { assignedCountryCodes, localizedCountryNames };
