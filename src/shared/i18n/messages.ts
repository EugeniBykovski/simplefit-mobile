import de from "./messages/de.json";
import en from "./messages/en.json";
import esMX from "./messages/es-MX.json";
import es from "./messages/es.json";
import fr from "./messages/fr.json";
import pl from "./messages/pl.json";
import ru from "./messages/ru.json";
import uk from "./messages/uk.json";
import { fallbackChain, type Locale } from "./locales";

/** Message shape, defined by the English (source) catalog. */
export type Messages = typeof en;

export type MessageTree = { [key: string]: string | MessageTree };

/**
 * Raw catalogs, one JSON file per locale (namespaces as top-level keys).
 * Static imports: Metro bundles every catalog (they are small). Locales with
 * a fallback (es-MX) contain only the keys they override.
 */
export const catalogs: Record<Locale, MessageTree> = {
  en,
  ru,
  pl,
  de,
  uk,
  es,
  "es-MX": esMX,
  fr,
};

/**
 * Messages for a locale, resolved through its fallback chain (es-MX -> es ->
 * en): every key renders text from the most specific locale that defines it,
 * so English is the final fallback and never a raw key.
 */
export function resolveMessages(locale: Locale): Messages {
  return fallbackChain(locale)
    .reverse()
    .reduce<MessageTree>((merged, layer) => withFallback(merged, catalogs[layer]), {}) as Messages;
}

/** Deep-merges `override` onto `base`; keys missing from `override` keep the base text. */
export function withFallback(base: MessageTree, override: MessageTree): MessageTree {
  const result: MessageTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = result[key];
    result[key] =
      typeof value === "object" && typeof baseValue === "object"
        ? withFallback(baseValue, value)
        : value;
  }
  return result;
}
