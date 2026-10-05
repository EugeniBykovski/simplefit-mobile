import { getCalendars, getLocales } from "expo-localization";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { IntlProvider } from "use-intl";

import { getPreference, setPreference } from "@/shared/storage/preferences";

import { formats } from "./formats";
import { type Locale } from "./locales";
import { resolveMessages } from "./messages";
import { resolveActiveLocale, resolveDeviceLocale } from "./resolve";

type LocaleContextValue = {
  locale: Locale;
  /** "explicit" when chosen in the app, "device" when following the OS. */
  source: "explicit" | "device";
  /** Locale the device alone would give (shown next to "Device language"). */
  deviceLocale: Locale;
  /** Choose a locale explicitly, or `null` to follow the device again. */
  setLocale: (locale: Locale | null) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Loads the persisted explicit locale (if any), otherwise follows the device,
 * and provides messages, named formats and the device time zone to use-intl.
 * Renders nothing until the preference has been read (the splash screen is
 * still visible), so the first frame is already in the right language.
 *
 * Time zone comes from the device calendar settings, never from the locale.
 */
export function I18nProvider({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  const deviceLocale = resolveDeviceLocale(getLocales());
  const [state, setState] = useState<{ locale: Locale; source: "explicit" | "device" } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void getPreference("locale").then((stored) => {
      if (!cancelled) setState(resolveActiveLocale(stored, getLocales()));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state) onReady?.();
  }, [state, onReady]);

  const setLocale = useCallback(
    async (locale: Locale | null) => {
      setState(
        locale ? { locale, source: "explicit" } : { locale: deviceLocale, source: "device" },
      );
      await setPreference("locale", locale);
    },
    [deviceLocale],
  );

  const value = useMemo(
    () => (state ? { ...state, deviceLocale, setLocale } : null),
    [state, deviceLocale, setLocale],
  );

  if (!value) return null;

  return (
    <LocaleContext.Provider value={value}>
      <IntlProvider
        locale={value.locale}
        messages={resolveMessages(value.locale)}
        formats={formats}
        timeZone={getCalendars()[0]?.timeZone ?? "UTC"}
      >
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}

export function useLocaleSettings(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocaleSettings must be used inside <I18nProvider>.");
  return value;
}
