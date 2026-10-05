import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme, View } from "react-native";

import { getPreference, setPreference } from "@/shared/storage/preferences";

import { palettes, themeVariables, type ColorScheme, type SemanticColors } from "./tokens";

export type ThemePreference = "dark" | "light" | "system";

export const DEFAULT_THEME: ThemePreference = "dark";

export type Theme = {
  /** The scheme in effect after resolving "system". */
  scheme: ColorScheme;
  /** Semantic colour values; only for native props that cannot take a className. */
  colors: SemanticColors;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<Theme | null>(null);

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "dark" || value === "light" || value === "system";
}

/**
 * Owns the theme preference: dark by default (the brand is dark-first), or
 * light / system as chosen by the user and persisted in preferences.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_THEME);

  useEffect(() => {
    let cancelled = false;
    void getPreference("theme").then((stored) => {
      if (!cancelled && isThemePreference(stored)) setPreferenceState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void setPreference("theme", next === DEFAULT_THEME ? null : next);
  }, []);

  const value = useMemo<Theme>(() => {
    const scheme: ColorScheme =
      preference === "system" ? (system === "light" ? "light" : "dark") : preference;
    return { scheme, colors: palettes[scheme], preference, setPreference: choose };
  }, [preference, system, choose]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active theme. Must be used inside <ThemeProvider>. */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return theme;
}

/**
 * Provides the semantic CSS variables every `bg-*` / `text-*` / `border-*`
 * token class reads. `style` is required here: NativeWind applies runtime
 * CSS variables through vars() style objects.
 */
export function ThemeRoot({ children }: { children: ReactNode }) {
  const { scheme } = useTheme();
  return (
    <View className="flex-1 bg-background" style={themeVariables(scheme)}>
      {children}
    </View>
  );
}
