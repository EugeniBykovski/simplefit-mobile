import { catalogs, resolveMessages, withFallback, type MessageTree } from "./messages";
import { defaultLocale, fallbackChain, locales } from "./locales";

function flatten(tree: MessageTree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((flat, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string"
      ? { ...flat, [path]: value }
      : { ...flat, ...flatten(value, path) };
  }, {});
}

/** ICU arguments ({name}) and rich-text tags (<tag>) a message relies on. */
const placeholders = (message: string) =>
  [...message.matchAll(/\{(\w+)|<\/?(\w+)>/g)].map((m) => m[1] ?? `<${m[2]}>`).sort();

const source = flatten(catalogs[defaultLocale]);
const sourceKeys = Object.keys(source).sort();
const regional = locales.filter((locale) => fallbackChain(locale).length > 2);
const full = locales.filter((locale) => locale !== defaultLocale && !regional.includes(locale));

describe("message catalogs", () => {
  it("has a catalog for every registered locale", () => {
    expect(Object.keys(catalogs).sort()).toEqual([...locales].sort());
  });

  it.each(full)("%s translates exactly the English keys", (locale) => {
    expect(Object.keys(flatten(catalogs[locale])).sort()).toEqual(sourceKeys);
  });

  it.each(regional)("%s only overrides keys that exist in English", (locale) => {
    for (const key of Object.keys(flatten(catalogs[locale]))) expect(sourceKeys).toContain(key);
  });

  it.each(locales.filter((l) => l !== defaultLocale))(
    "%s keeps the ICU arguments and tags of the English messages",
    (locale) => {
      for (const [key, message] of Object.entries(flatten(catalogs[locale]))) {
        expect([key, placeholders(message)]).toEqual([key, placeholders(source[key]!)]);
      }
    },
  );

  it.each(locales)("%s has no empty messages", (locale) => {
    for (const message of Object.values(flatten(catalogs[locale])))
      expect(message.trim()).not.toBe("");
  });

  it.each(locales)("resolves every English key for %s", (locale) => {
    expect(Object.keys(flatten(resolveMessages(locale) as MessageTree)).sort()).toEqual(sourceKeys);
  });
});

describe("resolveMessages", () => {
  it("resolves es-MX through es before English, keeping es-MX overrides", () => {
    const es = resolveMessages("es");
    const esMX = resolveMessages("es-MX");
    expect(esMX.actions.checkAgain).toBe("Verificar de nuevo");
    expect(es.actions.checkAgain).toBe("Comprobar de nuevo");
    expect(esMX.actions.openTheApp).toBe(es.actions.openTheApp);
    expect(esMX.apiHealth.title).toBe("Conexión con la API");
  });

  it("falls back to the base text for missing keys", () => {
    expect(withFallback({ a: "A", n: { b: "B", c: "C" } }, { n: { b: "B2" } })).toEqual({
      a: "A",
      n: { b: "B2", c: "C" },
    });
  });
});
