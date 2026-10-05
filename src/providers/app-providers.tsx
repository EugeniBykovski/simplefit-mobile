import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { makeQueryClient } from "@/shared/api/query-client";
import { connectOnlineManager, useAppStateFocus } from "@/shared/api/query-lifecycle";
import { I18nProvider } from "@/shared/i18n/i18n-provider";
import { ThemeRoot } from "@/shared/styles/theme";

connectOnlineManager();

/**
 * Global providers, outermost first:
 * - GestureHandlerRootView: required once at the root for gestures and sheets,
 * - SafeAreaProvider: insets for Screen,
 * - QueryClientProvider: the single QueryClient (server state),
 * - I18nProvider: locale, messages, formats, time zone,
 * - ThemeRoot: semantic colour variables for every token className.
 *
 * Add a provider here only for a genuinely app-wide concern.
 */
export function AppProviders({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  const [queryClient] = useState(makeQueryClient);
  useAppStateFocus();

  return (
    // eslint-disable-next-line no-restricted-syntax -- third-party root view without className support
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <I18nProvider onReady={onReady}>
            <ThemeRoot>{children}</ThemeRoot>
          </I18nProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
