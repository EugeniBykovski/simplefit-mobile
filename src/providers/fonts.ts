// Per-weight entry points: the package roots require every weight, which
// would bundle ~5 MB of unused font files.
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Unbounded_600SemiBold } from "@expo-google-fonts/unbounded/600SemiBold";
import { Unbounded_700Bold } from "@expo-google-fonts/unbounded/700Bold";
import { useFonts } from "expo-font";

/**
 * Brand typefaces (SIL OFL), bundled with the app. The names are the font
 * families used by tailwind.config.js (font-display, font-sans-*, font-mono).
 */
const appFonts = {
  Unbounded_600SemiBold,
  Unbounded_700Bold,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  JetBrainsMono_500Medium,
};

/**
 * True once fonts are ready, or loading failed (the app then falls back to the
 * system font rather than staying on the splash screen).
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(appFonts);
  return loaded || error !== null;
}
