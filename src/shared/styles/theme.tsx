import type { ReactNode } from "react";
import { useColorScheme, View } from "react-native";

import { palettes, themeVariables, type ColorScheme, type SemanticColors } from "./tokens";

export type Theme = { scheme: ColorScheme; colors: SemanticColors };

/**
 * The active theme. SF-12 follows the OS appearance; an explicit theme choice
 * (SF-13) will replace the useColorScheme() read with a stored preference.
 * Use `colors` only for native props that cannot take a className.
 */
export function useTheme(): Theme {
  const scheme: ColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  return { scheme, colors: palettes[scheme] };
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
