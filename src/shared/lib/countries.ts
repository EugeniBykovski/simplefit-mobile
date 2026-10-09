import { COUNTRY_CODES, COUNTRY_NAMES } from "./countries.data";

/**
 * Countries for the OF1 country selector (SF-39): the officially assigned
 * ISO 3166-1 alpha-2 codes the API accepts (`country_code`), named in the
 * reader's language. The table is generated from Unicode CLDR by
 * `scripts/generate-countries.mjs` (Hermes has no `Intl.DisplayNames`) with
 * the web client's rule; only the code is ever sent.
 */
export type CountryOption = { code: string; name: string };

export const COUNTRIES: readonly string[] = COUNTRY_CODES;

/** The names table of `locale`, or of its base language (es-MX → es), or English. */
function namesFor(locale: string): Record<string, string> {
  const base = locale.split("-")[0] ?? "en";
  return COUNTRY_NAMES[locale] ?? COUNTRY_NAMES[base] ?? COUNTRY_NAMES.en ?? {};
}

/** A country's name in `locale` (its code when the table has none). */
export function countryName(code: string, locale: string): string {
  return namesFor(locale)[code] ?? code;
}

/** Every country named in `locale`, sorted for that locale. */
export function countryOptions(locale: string): CountryOption[] {
  const names = namesFor(locale);
  return COUNTRY_CODES.map((code) => ({ code, name: names[code] ?? code })).sort((a, b) =>
    a.name.localeCompare(b.name, locale, { sensitivity: "base" }),
  );
}

/** Countries whose name or code contains `query` (case- and accent-insensitive). */
export function searchCountries(options: readonly CountryOption[], query: string): CountryOption[] {
  const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const needle = fold(query.trim());
  if (needle === "") return [...options];
  return options.filter(
    (option) => fold(option.name).includes(needle) || option.code.toLowerCase() === needle,
  );
}
