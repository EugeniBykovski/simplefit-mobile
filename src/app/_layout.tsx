import "../global.css";

import * as SplashScreen from "expo-splash-screen";

import { AppProviders } from "@/providers/app-providers";
import { useAppFonts } from "@/providers/fonts";
import { RootNavigator } from "@/providers/root-navigator";

// Keep the native splash screen until fonts and the locale preference are
// loaded, so the first rendered frame is already branded and localized.
void SplashScreen.preventAutoHideAsync();

const hideSplash = () => void SplashScreen.hideAsync();

export default function RootLayout() {
  const fontsReady = useAppFonts();
  if (!fontsReady) return null;

  return (
    <AppProviders onReady={hideSplash}>
      <RootNavigator />
    </AppProviders>
  );
}
