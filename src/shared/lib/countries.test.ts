import { COUNTRY_CODES, COUNTRY_NAMES } from "./countries.data";
import { COUNTRIES, countryName, countryOptions, searchCountries } from "./countries";

// The generator's own derivation (a CommonJS build script, typed here).
const source = jest.requireActual<{
  assignedCountryCodes: () => string[];
  localizedCountryNames: (codes: string[]) => unknown;
}>("../../../scripts/countries-source.js");

describe("countries", () => {
  it("is the officially assigned set the API accepts: 249 codes, no reserved or user-assigned code", () => {
    expect(COUNTRIES).toHaveLength(249);
    for (const code of ["PL", "DE", "UA", "US", "SS"]) expect(COUNTRIES).toContain(code);
    for (const code of ["UK", "EU", "XK", "ZZ", "AA", "QO", "YU", "AN"]) {
      expect(COUNTRIES).not.toContain(code);
    }
  });

  it("matches a fresh derivation from CLDR (run pnpm countries:generate when this fails)", () => {
    const codes = source.assignedCountryCodes();
    expect([...COUNTRY_CODES]).toEqual(codes);
    expect(COUNTRY_NAMES).toEqual(source.localizedCountryNames(codes));
  });

  it("names countries in the reader's language and falls back by base language", () => {
    expect(countryName("PL", "pl")).toBe("Polska");
    expect(countryName("DE", "de")).toBe("Deutschland");
    expect(countryName("ES", "es-MX")).toBe(countryName("ES", "es"));
    expect(countryName("PL", "xx")).toBe("Poland");
  });

  it("sorts for the locale and searches by name or code, ignoring accents", () => {
    const options = countryOptions("en");
    expect(options[0]?.name.localeCompare(options[1]?.name ?? "")).toBeLessThan(0);
    expect(searchCountries(options, "pol").map((option) => option.code)).toContain("PL");
    expect(searchCountries(countryOptions("fr"), "etats").map((option) => option.code)).toContain(
      "US",
    );
    expect(searchCountries(options, "de").some((option) => option.code === "DE")).toBe(true);
  });
});
