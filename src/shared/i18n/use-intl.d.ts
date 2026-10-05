import type { formats } from "./formats";
import type { Locale } from "./locales";
import type { Messages } from "./messages";

// Strongly types locales, message keys and named formats for use-intl APIs.
declare module "use-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
    Formats: typeof formats;
  }
}
