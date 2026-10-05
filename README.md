# SimpleFit Mobile

The **SimpleFit Boxing** app for iOS and Android: one app with role-aware
capabilities for Fighters, Coaches and Gym operators. This repository currently
contains the **foundation** (SF-12): Expo Router architecture, generated API
client, server state, i18n (8 locales), storage boundaries, utility-first
styling (NativeWind) with native UI primitives, tests, quality gates and CI.

Backend: [`simplefit-api`](https://github.com/EugeniBykovski/simplefit-api)
(Phoenix) owns business logic and the API contract. Web:
[`simplefit-platform`](https://github.com/EugeniBykovski/simplefit-platform).

## Requirements

| Tool           | Version                   | Notes                                                                             |
| -------------- | ------------------------- | --------------------------------------------------------------------------------- |
| Node.js        | 24.21                     | `nvm use` reads `.nvmrc`                                                          |
| pnpm           | 12.9.1                    | via Corepack (`corepack enable`), pinned in `package.json`                        |
| Xcode          | **26 or newer**           | iOS builds; Expo SDK 57 needs Swift 6.2. Xcode 16 fails to build `ExpoModulesJSI` |
| CocoaPods      | 1.16+                     | iOS builds                                                                        |
| Android Studio | current, with an emulator | Android builds (JDK 17, Android SDK)                                              |

## Getting started

```bash
nvm use
corepack enable
pnpm install                  # also installs git hooks
cp .env.example .env.local    # set EXPO_PUBLIC_API_URL (see below)
pnpm api:generate             # optional: refresh the API client from ../simplefit-api
pnpm ios                      # build + run a development build on the iOS Simulator
pnpm android                  # build + run on an Android emulator/device
pnpm start                    # Metro only (for an installed development build)
```

`pnpm ios` / `pnpm android` create a **development build** (native projects
are generated into the git-ignored `ios/` and `android/` folders). The app is
not designed around Expo Go; `pnpm start --go` works for quick JS-only checks
because every native module used today ships in Expo Go.

### Reaching your local API

`localhost` on a phone or emulator is the device itself:

| Running on       | `EXPO_PUBLIC_API_URL`                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| iOS Simulator    | `http://localhost:4000`                                                         |
| Android Emulator | `http://10.0.2.2:4000`                                                          |
| Physical device  | `http://<your computer's LAN IP>:4000` (same Wi-Fi; Phoenix bound to `0.0.0.0`) |

After changing it, restart Metro with `pnpm start --clear` (values are inlined
into the bundle). `EXPO_PUBLIC_*` values are public: never put secrets in them.
Production builds require `https://`.

## Scripts

| Command                                        | Purpose                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| `pnpm start` / `pnpm ios` / `pnpm android`     | Metro / iOS dev build / Android dev build                             |
| `pnpm lint`                                    | ESLint (zero warnings; enforces layer and storage/network boundaries) |
| `pnpm format` / `pnpm format:check`            | Prettier                                                              |
| `pnpm typecheck`                               | Generates typed routes, then `tsc --noEmit`                           |
| `pnpm test` / `pnpm test:watch`                | Jest (jest-expo) + React Native Testing Library                       |
| `pnpm api:sync` / `api:generate` / `api:check` | Sync OpenAPI snapshot / regenerate client / detect drift              |
| `pnpm expo:check`                              | Dependencies match the Expo SDK                                       |
| `pnpm config:check`                            | Expo config resolves                                                  |
| `pnpm expo:doctor`                             | expo-doctor project diagnostics                                       |
| `pnpm bundle:check`                            | Exports the iOS and Android JS bundles (headless)                     |
| `pnpm quality`                                 | Everything above that CI runs                                         |

## Common tasks

- **Add a translation key:** add it to `src/shared/i18n/messages/en.json`,
  translate it in every other catalog (`es-MX` only if Mexican Spanish
  differs), run `pnpm test`.
- **Add a locale:** add it to `src/shared/i18n/locales.json`, add its catalog,
  register it in `src/shared/i18n/messages.ts`, run `pnpm test`.
- **Style a component:** NativeWind `className` with semantic token classes
  (`bg-surface`, `text-muted-foreground`); `style` only for runtime values.
  No `StyleSheet.create` for ordinary styling (ESLint enforces it).
- **Add a UI primitive:** create it in `src/shared/ui` with token classes,
  accessibility role/label/state and a test.
- **Add a feature slice:** `src/features/<action>/` with `ui/`, optional
  `model/`, an `index.ts` public API and tests; compose it in a widget, render
  the widget from a thin route in `src/app`.
- **Call a new API endpoint:** never hand-write it. Merge the backend change,
  run `pnpm api:generate`, use the generated hook/function.

Supported locales: `en` (default), `ru`, `pl`, `de`, `uk`, `es`, `es-MX`, `fr`.

## Conventions

- Shared SimpleFit standards (workflow, ownership, quality gates, Definition of
  Done): [docs/engineering-standards.md](docs/engineering-standards.md).
- Branches: `SF-<ticket>-<kebab-description>`, e.g. `SF-16-identity-authentication`.
- Commits: `<type>: SF-<ticket> - <description>`, e.g. `feat: SF-16 - add identity domain`
  (commitlint, locally and in CI).
- PR titles: `SF-16 — Identity Authentication`; PRs are merged by a human.
- All user-facing copy goes through i18n; locale, time zone and currency are
  independent.

## Documentation

- [Architecture](docs/architecture/README.md): layers, Expo Router, API and
  Orval, transport, Query, forms, storage, i18n, styling, primitives, mobile
  UX, testing, accessibility, CI, EAS, security, dependencies.
- [CLAUDE.md](CLAUDE.md): non-negotiable engineering rules.
