import "../global.css";

import type { ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

import { AppProviders } from "@/providers/app-providers";
import { useAppFonts } from "@/providers/fonts";
import { RootNavigator } from "@/providers/root-navigator";
import { FailureView } from "@/widgets/system-states";

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

/**
 * Error boundary of the whole route tree (SF-34): it replaces the root
 * layout, so it brings the providers its failure state needs. It shows the
 * failure state only, never the error's message or stack; "Try again"
 * re-renders the tree.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <AppProviders onReady={hideSplash}>
      <FailureView error={error} onRetry={() => void retry()} />
    </AppProviders>
  );
}
