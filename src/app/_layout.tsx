import "../global.css";

import * as SplashScreen from "expo-splash-screen";

import { AppProviders } from "@/providers/app-providers";
import { RootNavigator } from "@/providers/root-navigator";

// Keep the native splash screen until the locale preference is loaded, so the
// first rendered frame is already in the user's language.
void SplashScreen.preventAutoHideAsync();

const hideSplash = () => void SplashScreen.hideAsync();

export default function RootLayout() {
  return (
    <AppProviders onReady={hideSplash}>
      <RootNavigator />
    </AppProviders>
  );
}
