# SimpleFit Mobile architecture

`simplefit-mobile` is the SimpleFit Boxing app for iOS and Android: the primary
experience for Fighters and a companion for Coaches and Gym operators. It is
**one app with role-aware capabilities**: a person may hold several roles at
once, so nothing assumes `user.role = fighter | coach | gym`. SF-12 built the
**foundation** only; product domains arrive with their own tickets.

- [System context](#system-context)
- [Stack](#stack)
- [Directory layout](#directory-layout)
- [Layers (FSD-inspired)](#layers-fsd-inspired)
- [Expo Router](#expo-router)
- [API contract and Orval](#api-contract-and-orval)
- [HTTP transport](#http-transport)
- [TanStack Query](#tanstack-query)
- [Forms and validation](#forms-and-validation)
- [Storage policy](#storage-policy)
- [Internationalization](#internationalization)
- [Locale, time zone and currency](#locale-time-zone-and-currency)
- [Styling and tokens](#styling-and-tokens)
- [Native UI primitives](#native-ui-primitives)
- [Screen composition and mobile UX](#screen-composition-and-mobile-ux)
- [Gestures, animation, lists](#gestures-animation-lists)
- [Environment](#environment)
- [Testing](#testing)
- [Accessibility](#accessibility)
- [Git and Jira conventions](#git-and-jira-conventions)
- [CI and native builds](#ci-and-native-builds)
- [EAS](#eas)
- [Security](#security)
- [Dependencies](#dependencies)
- [Known limitations](#known-limitations)

## System context

```
 iOS / Android app ──HTTPS/JSON──► simplefit-api (Phoenix)
        │                                  │
        └── generated client ◄── OpenAPI artifact (canonical)
```

The **Phoenix backend owns** business logic, authorization, validation,
persistence and the API contract. The app renders, collects input and calls
the API. It never re-implements business rules, never talks to a database and
never hand-writes backend DTOs. The web client (`simplefit-platform`) follows
the same rules; both generate their clients from the same artifact.

## Stack

| Concern      | Choice                                                                                  |
| ------------ | --------------------------------------------------------------------------------------- |
| Runtime      | Expo SDK 57, React Native 0.86 (New Architecture), React 19.2, React Compiler           |
| Toolchain    | Node 24 LTS (`.nvmrc`), pnpm 12 (`packageManager`), TypeScript 6 strict                 |
| Navigation   | Expo Router 57 (file-based, typed routes)                                               |
| Server state | TanStack Query 5 with React Native focus/online integration                             |
| API client   | Orval 8, generated from the backend OpenAPI (same as web)                               |
| Forms        | React Hook Form + Zod + @hookform/resolvers                                             |
| i18n         | use-intl 4 (next-intl's core: same ICU messages and API as web) + expo-localization     |
| Storage      | expo-secure-store (sensitive), AsyncStorage (preferences)                               |
| Styling      | NativeWind 4 (Tailwind 3.4) utility classes + semantic CSS-variable tokens (light/dark) |
| Icons        | lucide-react-native (same set as web)                                                   |
| Native       | react-native-gesture-handler, react-native-reanimated, safe-area-context, screens       |
| Tests        | Jest (jest-expo) + React Native Testing Library 14                                      |
| Quality      | ESLint 9 (eslint-config-expo), Prettier, Husky, lint-staged, commitlint, expo-doctor    |

## Directory layout

```
simplefit-mobile/
├── app.config.ts              Expo config (identity, plugins, experiments)
├── eas.json                   EAS build profiles (no account IDs)
├── openapi/simplefit.api.json verbatim snapshot of the backend contract
├── scripts/                   api-sync, api-check, commit convention
└── src/
    ├── app/                   Expo Router routes (thin): _layout, index, (app)/app, +not-found
    ├── providers/             app layer: global providers, root navigator, startup
    ├── widgets/               screen compositions (foundation-home, app-overview)
    ├── features/              user actions (switch-locale, check-api-health)
    ├── entities/              client representations of domain concepts (system-health)
    ├── shared/
    │   ├── api/               generated client, transport, ApiError, QueryClient, lifecycle
    │   ├── config/            validated env, site identity
    │   ├── i18n/              locale registry, catalogs, resolution, formats, provider
    │   ├── lib/               form helpers
    │   ├── storage/           secure-storage, preferences (the only persistence boundary)
    │   ├── styles/            tokens, useTheme
    │   └── ui/                native primitives (Text, Button, Input, Card, Screen, …)
    └── test/                  test helpers
```

`shared/hooks/` and `shared/types/` are created with their first real member.

**Why `src/app` + `src/providers`:** Expo Router (current recommended layout)
turns every file in `src/app/` into a route. The FSD "app" layer therefore
spans two folders: `src/app` (routes) and `src/providers` (non-route
composition such as providers and startup).

## Layers (FSD-inspired)

| Layer                            | Holds                                             | Example                   |
| -------------------------------- | ------------------------------------------------- | ------------------------- |
| app (`src/app`, `src/providers`) | routes, providers, startup, global composition    | `app/(app)/app.tsx`       |
| widgets                          | substantial screen composition                    | `widgets/foundation-home` |
| features                         | one user action / use case                        | `features/switch-locale`  |
| entities                         | domain-oriented client representations + their UI | `entities/system-health`  |
| shared                           | domain-independent infrastructure and primitives  | `shared/ui/button`        |

```
app/providers ─► widgets ─► features ─► entities ─► shared
```

Enforced by ESLint:

- imports only point rightwards (no layer imports a higher one);
- `fetch` is allowed only in `src/shared/api` (screens never call the network);
- `expo-secure-store` and AsyncStorage are importable only in `src/shared/storage`;
- `process.env` is read only in `src/shared/config`.

Slices on the same layer do not import each other. Each slice exposes one
`index.ts`; inside `shared`, import files directly. No other barrels. **No
placeholder slices** (fighter, coach, gym, sparring, …): they appear with their
tickets.

## Expo Router

- Routes live in `src/app`; **route files stay thin**: they render a widget
  and contain no business logic or API calls.
- **Every product route comes from the canonical route registry**
  (`docs/route-registry.json`, contract `docs/route-architecture.md`, SF-31):
  path, shell (route group), access and status. `scripts/route-registry.test.js`
  fails when a route file is not in the registry or an implemented route is
  missing. Planned groups: `(auth)`, `(onboarding)`, `(fighter)`, `(coach)`,
  `(gym)`, `(shared)` (SF-33).
- Current routes: `/` (foundation home), `/app` (future signed-in area, in the
  `(app)` group), `+not-found` (unknown routes and deep links).
- Route groups: `(app)` exists now and is where the auth ticket adds its guard.
  `(auth)` (sign-in flows) and `(modal)` (modal presentations) are created by
  the tickets that need them.
- **Typed routes** are on: `router.push("/app")` is type-checked.
  `pnpm typecheck` generates the route types headlessly
  (`expo customize tsconfig.json`), so CI checks them without a dev server.
- **Deep links:** the URL scheme is `simplefit` (`simplefit://app` opens
  `/app`). Universal Links (iOS) and App Links (Android) need an owned domain
  serving `apple-app-site-association` / `assetlinks.json`; when the domain
  exists, add `ios.associatedDomains` and `android.intentFilters` to
  `app.config.ts`. Unknown links land on `+not-found`. Links into the signed-in
  area will pass through the `(app)` guard.

## API contract and Orval

Same pipeline as `simplefit-platform`:

```
simplefit-api/openapi/simplefit.api.json  (canonical, owned by the backend)
        │  pnpm api:sync    (verbatim copy; part of api:generate)
        ▼
openapi/simplefit.api.json                (committed snapshot)
        │  Orval            (orval.config.ts)
        ▼
src/shared/api/generated/                 (committed, DO NOT EDIT MANUALLY)
  model/      DTO types
  endpoints/  per tag: request functions + TanStack Query hooks
```

| Command             | What it does                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm api:sync`     | Copies the backend artifact (sibling checkout, or `SIMPLEFIT_API_OPENAPI=<path>`)                                                     |
| `pnpm api:generate` | `api:sync --if-present`, then Orval                                                                                                   |
| `pnpm api:check`    | Fails on snapshot drift vs the backend (when available locally), stale or hand-edited generated files, and unexpected generated files |

**Propagating a backend change:** merge the backend change → `pnpm
api:generate` → review the `openapi/` and `generated/` diff → adapt callers →
commit together. CI does not need the backend repository: it verifies the
generated code against the committed snapshot.

Rules: never edit generated code or the snapshot; never hand-write DTOs (use
`@/shared/api/generated/model`); generated files carry `DO NOT EDIT MANUALLY`,
are ignored by ESLint/Prettier and marked `linguist-generated`. Orval needs no
browser assumptions here: it targets `fetch` with our transport as mutator.

## HTTP transport

`src/shared/api/http/api-fetch.ts` is the single transport (Orval mutator):

- base URL from `EXPO_PUBLIC_API_URL` (validated); JSON in and out;
- **timeout** (15 s default, `timeoutMs` per request) → `ApiError("timeout")`;
- **cancellation**: the caller's `signal` (TanStack Query passes one) aborts
  the request and the abort is rethrown unchanged (Query treats it as a
  cancellation, not an error);
- **normalized errors**: every failure is an `ApiError` with `kind`
  (`http` | `network` | `timeout`), `status` (0 without a response), `code`
  (backend envelope code, or `network_error` / `timeout` /
  `unexpected_response`), `details`, `requestId` (`x-request-id`) and
  `fieldErrors` for `validation_error`;
- no business logic; no Axios (fetch is sufficient).

Extension points, implemented by their tickets: auth header injection in
`buildHeaders` (token from secure storage), 401 handling/refresh before
throwing, a client correlation header.

## TanStack Query

- One QueryClient (`makeQueryClient`) created in `providers/app-providers.tsx`.
- Defaults: `staleTime` 30 s; **4xx never retried** (401/403 are left to the
  future auth layer); network errors, timeouts and 5xx retried at most twice;
  **mutations never retried** automatically.
- **App lifecycle:** `AppState` drives `focusManager` (foreground = focused),
  so stale queries refetch when the app returns.
- **Connectivity:** `expo-network` drives `onlineManager`: offline queries
  pause and resume on reconnect (`refetchOnReconnect`).
- Not in SF-12: an offline-first sync engine or a persisted query cache.
- No Redux, no global client store. Add one only when a ticket proves the need.

## Forms and validation

React Hook Form + Zod (`zodResolver`), rendered with `Input` via `Controller`.
Zod improves UX; **Phoenix is the canonical validator**. Never encode business
rules (eligibility, pricing, permissions, uniqueness) in Zod. After submit, map
backend `validation_error` onto the form with
`applyApiFieldErrors(error, form.setError, fields)`; unknown fields go to
`root.server`. Validation copy goes through i18n.

## Storage policy

| Data                                                              | Where                                         | API                               |
| ----------------------------------------------------------------- | --------------------------------------------- | --------------------------------- |
| Sensitive (future auth access/refresh tokens, device credentials) | Keychain / Keystore via **expo-secure-store** | `@/shared/storage/secure-storage` |
| Non-sensitive preferences (explicit locale today)                 | AsyncStorage (unencrypted)                    | `@/shared/storage/preferences`    |
| Server data                                                       | TanStack Query (memory)                       | generated hooks                   |

- **SecureStore is not a general database:** small string values only (well
  under 2 KB), no querying, slower than memory. Items are stored
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (no backup migration to other devices).
- **Never** put tokens, secrets or personal data in AsyncStorage.
- Every preference key is declared in `preferences.ts` so the persisted device
  state is visible in one place.
- ESLint blocks importing either native module outside `src/shared/storage`.

## Internationalization

### Locales

| Code    | Language          | Selector label   | Fallback chain  |
| ------- | ----------------- | ---------------- | --------------- |
| `en`    | English (default) | English          | en              |
| `ru`    | Russian           | Русский          | ru → en         |
| `pl`    | Polish            | Polski           | pl → en         |
| `de`    | German            | Deutsch          | de → en         |
| `uk`    | Ukrainian         | Українська       | uk → en         |
| `es`    | Spanish           | Español          | es → en         |
| `es-MX` | Spanish (Mexico)  | Español (México) | es-MX → es → en |
| `fr`    | French            | Français         | fr → en         |

**Single source of truth:** `src/shared/i18n/locales.json` (data), typed and
wrapped by `locales.ts`. `app.config.ts` reads the same JSON to register the
languages with iOS/Android per-app language settings. Codes are identical to
the web platform.

`es-MX` is a regional locale of Spanish: its catalog holds only regional
overrides (e.g. "Verificar" instead of "Comprobar"); everything else is
inherited from `es`, then `en`.

### Resolution

1. An **explicit in-app choice** (persisted in preferences) always wins.
2. Otherwise the **device languages** (expo-localization), in the user's order:
   first exact supported tag (`es-MX`), else first supported base language
   (`es-AR` → `es`, `de-AT` → `de`), else English.
3. "Device language" in the selector clears the explicit choice.

Never geolocation. A stored locale that is no longer supported is ignored.
The provider renders after the preference loads while the splash screen is
still visible, so the first frame is already localized.

### Messages

- One catalog per locale: `src/shared/i18n/messages/<locale>.json`, namespaces
  as top-level keys: `common`, `navigation`, `actions`, `errors` (generic) and
  screen/slice namespaces (`home`, `language`, `appShell`, `apiHealth`).
- ICU message syntax (same as web; use-intl): `{name}` arguments, plurals,
  rich text tags (`<code>…</code>`).
- English is the schema: message keys are type-checked (use-intl `AppConfig`).
- Tests fail on missing keys, unknown keys, empty messages and ICU
  argument/tag mismatches for every locale.
- Only translate UI that exists; no copy for future screens.
- **Adding a key:** add it to `en.json`, translate it in every full catalog
  (not `es-MX` unless Mexican Spanish differs), run `pnpm test`.
- **Adding a locale:** add it to `locales.json` (with `fallback` for a
  regional variant), add its catalog and register it in `messages.ts`.

Usage: `const t = useTranslations("apiHealth")`, `t("title")`,
`t.rich("errorCode", { errorCode, code: (c) => <Text>{c}</Text> })`.

## Locale, time zone and currency

These are **independent**:

- **Locale** = language and formatting conventions.
- **Time zone** = from the device calendar settings
  (`expo-localization getCalendars()`), later from the user profile. Never from
  the locale (`ru` can live in `Europe/Warsaw`).
- **Currency** = from the business context (gym, payment, user), always passed
  explicitly: `format.number(amount, { style: "currency", currency })`. `es`
  does not mean EUR, `es-MX` does not mean MXN; no currency is configured
  globally.

Formatting uses Intl through use-intl (`useFormatter`) with named presets in
`shared/i18n/formats.ts` (`date`, `dateTime`, `time`, `integer`, `decimal`,
`percent`), the same names as web.

## Styling and tokens

**Utility-first styling** (shared SimpleFit convention for web and mobile).

- **Static styling uses NativeWind `className`**: spacing, padding, margin,
  gap, flex layout, alignment, dimensions expressible as tokens, borders,
  radius, background and text colours, typography, static positioning.
  ```tsx
  <View className="gap-2">…</View>            // yes
  const styles = StyleSheet.create({ … })     // no, for ordinary styling
  ```
- **`style` is for what className cannot express**: Reanimated animated
  styles, gesture-driven transforms, runtime-calculated values (e.g. safe-area
  insets), dynamic dimensions, NativeWind `vars()` theme variables, and
  third-party components without className support. Combine them as
  `className="…static…" style={dynamicPart}`.
- No CSS-in-JS, no styled-components, no style-constant modules created to
  avoid writing className. Styling stays colocated with the component unless
  it is a reusable design-system primitive.
- **Enforced by ESLint** (`src/**`): `StyleSheet.create(...)` and inline
  `style` objects made only of literal values are errors. A justified
  exception uses `// eslint-disable-next-line no-restricted-syntax -- <reason>`
  (today: `GestureHandlerRootView style={{ flex: 1 }}`, a third-party root
  without className support).
- Conditional classes are literal strings (template literals), so Tailwind
  sees every class; never build class names by concatenating fragments.
  `prettier-plugin-tailwindcss` orders classes (same as web).

**Setup:** NativeWind 4.2 (stable) with Tailwind CSS 3.4: `tailwind.config.js`
(NativeWind preset), `src/global.css` (imported once in `app/_layout.tsx`),
`babel.config.js` (`jsxImportSource: "nativewind"` + `nativewind/babel`),
`metro.config.js` (`withNativeWind`), `nativewind-env.d.ts` (className types).
NativeWind 5 (Tailwind 4, matching web) is a release candidate; migrate when it
is stable.

**Tokens, theme and primitives:** see **[design-system.md](../design-system.md)**
(SF-13: Graphite × Olive tokens shared with web, dark-default theme with a
persisted dark/light/system preference, brand fonts, raw-colour lint guard,
the primitive catalogue and the dev-only gallery). In short:

- `shared/styles/tokens.ts` is the single source of colour values (raw
  palette + semantic `palettes.dark|light`, same names as web);
  `tailwind.config.js` replaces Tailwind's palette with the semantic tokens.
- `ThemeProvider`/`ThemeRoot` (`shared/styles/theme.tsx`) apply the active
  palette as NativeWind `vars()`. Native props that cannot take a className
  read `useTheme().colors`.
- No web-only libraries (no shadcn DOM components, no Radix).

## Native UI primitives

Locally owned in `src/shared/ui`, styled with token classes, all accessible:
`Text`, `Button`, `Input`, `Textarea`, `Checkbox`, `RadioGroup`, `Switch`,
`SegmentedControl`, `Badge`, `Avatar`, `Card`, `Separator`, `Skeleton`,
`Spinner`, `Modal`, `Toast` (`ToastProvider`/`useToast`), `Screen`, `Icon`
(Lucide). Variants, sizes and accessibility contracts are in
[design-system.md](../design-system.md). Add a primitive only when a screen
needs it; keep labels as props (no copy in primitives); add it to the gallery.

## Screen composition and mobile UX

- Root: `GestureHandlerRootView` → `SafeAreaProvider` → `QueryClientProvider`
  → `I18nProvider` → themed `Stack`; `expo-status-bar` style follows the theme.
- `Screen` is intentionally small: safe-area edges (insets applied via
  `style`, the only runtime part) (default excludes `top`
  because the header handles it; header-less screens add `top`), background,
  optional `ScrollView` with `keyboardShouldPersistTaps="handled"`.
- **Forms:** wrap content in `KeyboardAvoidingView` (`behavior="padding"` on
  iOS) inside a scrolling Screen. Add react-native-keyboard-controller only if
  forms need more.
- **Lists:** use a virtualized list as the screen body, not `scroll`.
- Touch targets ≥ 44 pt (`touchTarget`, plus `hitSlop`).
- **Android back:** the native stack handles hardware/gesture back;
  predictive back is disabled until screens are verified with it.
- iOS conventions: native stack headers, minimal back button label, large
  content inset adjustment in scroll views.

## Gestures, animation, lists

- react-native-gesture-handler, Reanimated 4 and worklets are installed and
  configured at the root (babel-preset-expo handles the worklets plugin), so
  sheets, swipes and gesture-driven training controls need no root changes.
  No decorative animation in SF-12.
- **FlashList (2.x)** is the planned standard for large lists (feeds,
  histories, rosters, messages). It is compatible with SDK 57 (JS-only on the
  New Architecture) but deferred until the first real list exists.

## Environment

| Variable              | Scope            | Purpose                                                                   |
| --------------------- | ---------------- | ------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | public (bundled) | API base URL, no trailing slash; `https://` required in production builds |

- `EXPO_PUBLIC_*` is **public**: inlined into the bundle and extractable from
  the binary. Never secrets.
- Validated with Zod in `shared/config/env.ts`; read only there.
- `.env.local` (git-ignored) for local values; `.env.example` documents all.

**Reaching your local API (`mix phx.server` on port 4000):**

| Target           | `EXPO_PUBLIC_API_URL`                                           |
| ---------------- | --------------------------------------------------------------- |
| iOS Simulator    | `http://localhost:4000` (shares the Mac's network)              |
| Android Emulator | `http://10.0.2.2:4000` (`localhost` is the emulator itself)     |
| Physical device  | `http://<your-LAN-IP>:4000`, same Wi-Fi, API bound to `0.0.0.0` |

Restart with `pnpm start --clear` after changing values. Plain `http://` is
for local development only.

## Testing

- **Jest via jest-expo** (Expo's supported preset) + **React Native Testing
  Library 14** (async `render`, `userEvent`, built-in matchers). The web uses
  Vitest; React Native's transform and native-module mocking are best
  supported by jest-expo.
- Native modules are faked in `jest.setup.ts` (AsyncStorage official mock,
  in-memory SecureStore, controllable expo-localization, expo-network).
- `src/test/render.tsx` → `renderWithProviders(ui, { deviceLocales,
storedLocale })` renders with the real I18nProvider and a fresh QueryClient.
- Mock the network at `fetch`; query by role and accessible name.
- Covered: env validation, ApiError normalization, transport (headers, JSON,
  HTTP/network/timeout errors, cancellation), generated client wiring, retry
  policy, query lifecycle, form error mapping, locale registry, all 8 catalogs
  (completeness, placeholders, es-MX overrides), device/explicit locale
  resolution, provider persistence, formatting for all locales and time zone
  independence, storage boundary, primitives' accessibility, language
  selector, API health card, foundation home, commit convention.
- **E2E (future):** Maestro flows against EAS development/preview builds once
  real user journeys exist (sign-in, onboarding), run in a scheduled or
  pre-release pipeline rather than on every commit.

## Accessibility

Mandatory. Primitives set `accessibilityRole`, `accessibilityLabel`,
`accessibilityState` (disabled, busy, checked), headers for titles, live
regions for async status and errors, 44 pt targets and font scaling. Status is
never conveyed by colour alone (icon + text). Decorative icons and separators
are hidden from assistive technology; non-English labels carry `lang` for
correct pronunciation. Tests assert roles, names and states.

## Git and Jira conventions

Shared SimpleFit rules: [engineering-standards.md](../engineering-standards.md).

```
<type>: SF-<ticket> - <description>

feat: SF-16 - add identity domain
test: SF-16 - cover session rotation
docs: SF-16 - document authentication architecture
```

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`,
  `perf`. Jira key `SF-[0-9]+` is mandatory. No scopes; header ≤ 100
  characters. Merge commits and GitHub's `Revert "…"` commits are exempt.
- Enforced by commitlint (custom rule in `scripts/commit-convention.js`) in the
  `commit-msg` hook and for every PR commit in CI.
- `pre-commit`: lint-staged (ESLint `--fix` + Prettier on staged files only).
- Branches: `SF-<ticket>-<kebab-description>` (e.g.
  `SF-16-identity-authentication`). PR titles: `SF-16 — Identity Authentication`.
- All work goes through ticket branches and PRs; PRs are merged by a human.

## CI and native builds

`.github/workflows/ci.yml` (PRs and pushes to `main`, Ubuntu): frozen install
→ commitlint (PRs) → lint → format → typecheck (with generated route types) →
tests → `api:check` → `expo install --check` → `expo config` → expo-doctor →
Metro export of the iOS and Android JS bundles.

This proves the JavaScript app and its configuration; **it does not prove a
native iOS or Android build**. Native builds are validated locally (`pnpm ios`
/ `pnpm android`) and, once the EAS project exists, by EAS Build on demand
(development/preview) and for releases. Cloud builds are not run on every
commit.

## EAS

`eas.json` defines `development` (dev client, internal), `preview` (internal,
`preview` channel) and `production` (auto-increment, `production` channel)
with remote app versioning. It contains **no account-bound values**. Later:

1. `eas init`: creates the EAS project and writes `extra.eas.projectId`.
2. `eas credentials`: Apple Team / certificates / provisioning, Android
   keystore (stored by EAS, never in Git).
3. Set `EXPO_PUBLIC_API_URL` per environment with `eas env` (https).
4. EAS Update: add `expo-updates` and `runtimeVersion` when OTA updates are
   introduced.

## Security

- No secrets in Git or in source; `EXPO_PUBLIC_*` is public.
- Sensitive device data only in SecureStore; never AsyncStorage.
- Never log tokens, credentials or API request/response bodies.
- TLS required in production (`https://` enforced by env validation); never
  disable certificate validation or add cleartext exceptions for production.
- Generated API code is never edited by hand.
- The backend is the authorization owner; client checks are UX only.
- Certificate pinning is out of scope for SF-12.

## Dependencies

Each needs a current problem, a reason existing tools fall short, and active
maintenance. Versions are pinned exactly to the SDK 57 set (`pnpm expo:check`
verifies), pnpm enforces a minimum release age, and install scripts are denied
unless reviewed in `pnpm-workspace.yaml`.

Installed beyond the obvious: `react-dom` (required peer of
`@expo/metro-runtime`; the app does not target web), `@react-native/metro-config`
(pinned to RN 0.86 to satisfy the CLI peer), `expo-font` (loads the bundled brand fonts), `test-renderer` 1.2 (RNTL peer matching React 19.2),
`expo-doctor` (pinned project diagnostics), `nativewind` 4.2.7 +
`tailwindcss` 3.4.19 (utility-first styling), `react-native-css-interop` 0.2.7
(imported by NativeWind's JSX transform from app code, so it must be a direct
dependency under pnpm), `babel-preset-expo` (resolvable from
`babel.config.js` under pnpm), `prettier-plugin-tailwindcss` (class order, as
on web), `lucide-react-native` + `react-native-svg` (SF-13: the single icon
set, same as web's `lucide-react`; ISC / MIT; replaces `@expo/vector-icons`),
`@expo-google-fonts/unbounded|manrope|jetbrains-mono` (SF-13: brand
typefaces, SIL OFL; imported per weight).

**Deferred until a ticket needs them:** FlashList, keyboard-controller,
expo-image, haptics, auth SDKs (Google/Apple), Stripe, RevenueCat, Sentry,
PostHog/analytics, Firebase, push notifications, camera/pickers, maps/location,
WebSockets, rich text, charts/Skia, biometrics, health/wearables, uploads,
sharing, feature flags, query cache persistence, Maestro/Detox, expo-updates.

**Rejected:** react-native-web, Axios, Redux/Zustand, i18next (would diverge
from web's ICU messages), CSS-in-JS / styled-components, NativeWind 5 RC (until
stable), eslint-plugin-react-native-a11y (ESLint ≤ 8 only). clsx /
tailwind-merge / CVA are not added: typed variant maps of literal class
strings cover the SF-13 primitives. `@gorhom/bottom-sheet` is deferred until a
screen needs a sheet (`Modal` until then).

## Known limitations

- ESLint 9 (deprecated upstream) because `eslint-config-expo` and its React
  plugin are not ESLint 10-ready (same as web).
- The device-language rule maps regional variants to the base language
  (`es-AR` → `es`), whereas the web's Accept-Language negotiation (CLDR) maps
  Latin American Spanish to `es-MX`.
- Translations other than English were written during SF-12 and need review
  by native speakers before launch.
- The app icon and splash image are still placeholders (brand fonts and
  colours arrived with SF-13; icon artwork has not been delivered yet).
- `BottomSheet` is not implemented (see design-system.md).
- Jest does not compute NativeWind styles (no Metro CSS compilation), so
  component tests assert behaviour and accessibility; token wiring is covered
  by a config test, and visual output was checked on the iOS Simulator.
- NativeWind 4 is tied to Tailwind 3.4 while web uses Tailwind 4; token names
  are shared, configuration syntax differs until NativeWind 5.
- **iOS native builds need Xcode 26+**: SDK 57's `ExpoModulesJSI` Swift
  package requires Swift tools 6.2. On the bootstrap machine (Xcode 16.4) the
  local development build failed for this reason; the app was run on the iOS
  Simulator through Expo Go (SDK 57) instead. EAS Build images for SDK 57 ship
  Xcode 26.
- Android was not validated on a device or emulator in SF-12 (no Android SDK
  on the bootstrap machine); CI only bundles the Android JavaScript.
