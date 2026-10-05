import registry from "./locales.json";

/**
 * Canonical locale registry: the single source of truth for supported locales.
 * The data lives in locales.json so app.config.ts (plain Node, no TypeScript
 * module resolution) reads the same list for OS per-app language settings.
 *
 * Codes are canonical BCP 47 tags ("es-MX"), identical to simplefit-platform.
 * Each entry: `name` = the language's name in that language (endonym, shown in
 * the selector); optional `fallback` = locale to inherit missing messages from
 * before English (es-MX -> es).
 *
 * Adding a locale:
 * 1. add an entry to locales.json (order = order in the language selector),
 * 2. add src/shared/i18n/messages/<locale>.json (a locale with a `fallback`
 *    only needs the keys it overrides) and register it in messages.ts,
 * 3. run `pnpm test`: the i18n tests report missing or unknown keys.
 */
type LocaleDefinition = {
  readonly name: string;
  readonly fallback?: string;
};

export const localeRegistry: Readonly<Record<keyof typeof registry, LocaleDefinition>> = registry;

export type Locale = keyof typeof registry;

export const locales = Object.keys(localeRegistry) as Locale[];

/** English is the default locale and the final fallback for every message. */
export const defaultLocale: Locale = "en";

export function localeName(locale: Locale): string {
  return localeRegistry[locale].name;
}

/** Message lookup order for a locale, most specific first: es-MX -> es -> en. */
export function fallbackChain(locale: Locale): Locale[] {
  const chain: Locale[] = [];
  let current: Locale | undefined = locale;
  while (current && !chain.includes(current)) {
    chain.push(current);
    const definition: LocaleDefinition = localeRegistry[current];
    current = definition.fallback as Locale | undefined;
  }
  if (!chain.includes(defaultLocale)) chain.push(defaultLocale);
  return chain;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(localeRegistry, value);
}

/**
 * Maps a tag onto a supported locale, tolerating case differences
 * ("es-mx" -> "es-MX"). Unregistered tags (including regional variants such as
 * "es-AR") resolve to undefined: it never guesses.
 */
export function matchLocale(requested: string | null | undefined): Locale | undefined {
  if (!requested) return undefined;
  if (isLocale(requested)) return requested;
  let canonical: string | undefined;
  try {
    canonical = Intl.getCanonicalLocales(requested)[0];
  } catch {
    return undefined;
  }
  return locales.find((locale) => locale === canonical);
}
