import { resolveActiveLocale, resolveDeviceLocale } from "./resolve";

const device = (...tags: string[]) =>
  tags.map((languageTag) => ({ languageTag, languageCode: languageTag.split("-")[0] ?? null }));

describe("resolveDeviceLocale", () => {
  it.each([
    [["en-US"], "en"],
    [["ru-RU"], "ru"],
    [["pl-PL"], "pl"],
    [["de-AT"], "de"],
    [["uk-UA"], "uk"],
    [["es-ES"], "es"],
    [["es-MX"], "es-MX"],
    [["es-AR"], "es"],
    [["fr-CA"], "fr"],
  ])("maps device %j to %s", (tags, locale) => {
    expect(resolveDeviceLocale(device(...tags))).toBe(locale);
  });

  it("prefers an exact match anywhere in the list over a base-language match", () => {
    expect(resolveDeviceLocale(device("es-AR", "es-MX"))).toBe("es-MX");
  });

  it("walks the device preference order", () => {
    expect(resolveDeviceLocale(device("pt-BR", "uk-UA", "en-US"))).toBe("uk");
  });

  it("falls back to English when no device language is supported", () => {
    expect(resolveDeviceLocale(device("pt-BR", "ja-JP"))).toBe("en");
    expect(resolveDeviceLocale([])).toBe("en");
  });
});

describe("resolveActiveLocale", () => {
  it("lets an explicit choice override the device language", () => {
    expect(resolveActiveLocale("pl", device("de-DE"))).toEqual({
      locale: "pl",
      source: "explicit",
    });
  });

  it("follows the device without a stored choice", () => {
    expect(resolveActiveLocale(null, device("de-DE"))).toEqual({ locale: "de", source: "device" });
  });

  it("ignores a stored value that is no longer supported", () => {
    expect(resolveActiveLocale("pt", device("fr-FR"))).toEqual({ locale: "fr", source: "device" });
  });
});
