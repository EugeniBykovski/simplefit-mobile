import {
  defaultLocale,
  fallbackChain,
  isLocale,
  localeName,
  locales,
  matchLocale,
} from "./locales";

describe("locale registry", () => {
  it("supports the 8 canonical SimpleFit locales with English as default", () => {
    expect(locales).toEqual(["en", "ru", "pl", "de", "uk", "es", "es-MX", "fr"]);
    expect(defaultLocale).toBe("en");
  });

  it("names every locale in its own language (no flags)", () => {
    expect(locales.map(localeName)).toEqual([
      "English",
      "Русский",
      "Polski",
      "Deutsch",
      "Українська",
      "Español",
      "Español (México)",
      "Français",
    ]);
  });

  it("uses canonical BCP 47 tags", () => {
    for (const locale of locales) expect(Intl.getCanonicalLocales(locale)[0]).toBe(locale);
  });

  it("falls back es-MX -> es -> en and every other locale -> en", () => {
    expect(fallbackChain("es-MX")).toEqual(["es-MX", "es", "en"]);
    expect(fallbackChain("es")).toEqual(["es", "en"]);
    expect(fallbackChain("uk")).toEqual(["uk", "en"]);
    expect(fallbackChain("en")).toEqual(["en"]);
  });
});

describe("matchLocale", () => {
  it.each(locales)("recognizes %s", (locale) => {
    expect(matchLocale(locale)).toBe(locale);
    expect(isLocale(locale)).toBe(true);
  });

  it("canonicalizes case and keeps es and es-MX distinct", () => {
    expect(matchLocale("es-mx")).toBe("es-MX");
    expect(matchLocale("EN")).toBe("en");
    expect(matchLocale("es")).toBe("es");
  });

  it.each(["es-AR", "en-US", "pt", "zz", "not a locale", "", null, undefined, "toString"])(
    "does not treat %s as supported",
    (value) => {
      expect(matchLocale(value)).toBeUndefined();
    },
  );
});
