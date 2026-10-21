import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react-native";
import { getLocales } from "expo-localization";
import type { ReactElement, ReactNode } from "react";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { I18nProvider } from "@/shared/i18n/i18n-provider";
import { ThemeProvider, ThemeRoot } from "@/shared/styles/theme";
import { ToastProvider } from "@/shared/ui/toast";
import type { Locale } from "@/shared/i18n/locales";
import { setPreference } from "@/shared/storage/preferences";

type Options = {
  /** Device languages reported by expo-localization (default en-US). */
  deviceLocales?: { languageTag: string; languageCode: string | null }[];
  /** Explicitly chosen locale already persisted (default: none). */
  storedLocale?: Locale;
};

/**
 * Renders UI the way the app does: real I18nProvider (messages, fallbacks,
 * formats), ThemeProvider (dark default), ToastProvider and a fresh QueryClient with retries disabled. Resolves once the
 * locale preference has loaded.
 */
export async function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const test = expect.getState().currentTestName;
  if (options.deviceLocales)
    jest.mocked(getLocales).mockReturnValue(options.deviceLocales as never);
  if (options.storedLocale) await setPreference("locale", options.storedLocale);
  const queryClient = new QueryClient({
    // No garbage-collection timers: a finished mutation otherwise schedules a
    // 5-minute one that keeps the Jest worker alive after the run.
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  clients.add(queryClient);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider initialMetrics={TEST_METRICS}>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <ThemeProvider>
              <ThemeRoot>
                <ToastProvider>
                  {children}
                  <Text testID="i18n-ready" />
                </ToastProvider>
              </ThemeRoot>
            </ThemeProvider>
          </I18nProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  }

  const result = await render(ui, { wrapper: Wrapper });
  await screen.findByTestId("i18n-ready");
  if (expect.getState().currentTestName !== test) {
    // A test that timed out finished rendering during a later one: its tree
    // must not become that test's `screen`.
    await result.unmount();
    throw new Error(`renderWithProviders outlived its test: ${test ?? "(unknown)"}`);
  }
  return { queryClient, ...result };
}

/** The query clients of the current test; dropped after it, so no request of one test answers in the next. */
const clients = new Set<QueryClient>();
afterEach(async () => {
  // Unmount first (RNTL's own cleanup then has nothing left), so dropping the
  // queries notifies no mounted screen.
  await cleanup();
  for (const client of clients) {
    await client.cancelQueries();
    client.clear();
  }
  clients.clear();
});

/** iPhone-like frame and insets for components that read safe-area insets. */
const TEST_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** A fetch Response with a JSON body. */
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

/** Replaces global fetch for one test. */
export function mockFetch(implementation: jest.Mock): jest.Mock {
  global.fetch = implementation as unknown as typeof fetch;
  return implementation;
}
