import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { makeQueryClient } from "@/shared/api/query-client";
import { connectOnlineManager, useAppStateFocus } from "@/shared/api/query-lifecycle";
import { I18nProvider } from "@/shared/i18n/i18n-provider";
import { ThemeProvider, ThemeRoot } from "@/shared/styles/theme";
import { ToastProvider } from "@/shared/ui/toast";

connectOnlineManager();

/**
 * Global providers, outermost first:
 * - GestureHandlerRootView: required once at the root for gestures and sheets,
 * - SafeAreaProvider: insets for Screen,
 * - QueryClientProvider: the single QueryClient (server state),
 * - I18nProvider: locale, messages, formats, time zone,
 * - ThemeProvider + ThemeRoot: theme preference (dark default) and the
 *   semantic colour variables every token className reads,
 * - ToastProvider: transient feedback above every screen (needs the theme).
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
            <ThemeProvider>
              <ThemeRoot>
                <ToastProvider>{children}</ToastProvider>
              </ThemeRoot>
            </ThemeProvider>
          </I18nProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
