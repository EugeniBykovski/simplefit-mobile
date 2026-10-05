# CLAUDE.md — SimpleFit Mobile engineering rules

Rules for every Claude Code session in this repository. They are
non-negotiable unless the Jira ticket you are working on explicitly says
otherwise. If a ticket seems to require breaking one, stop and ask.

Read `docs/architecture/README.md` before structural changes.

## What this is

The SimpleFit Boxing iOS/Android app: Expo SDK 57, React Native 0.86 (New
Architecture), React 19.2, TypeScript 6 strict, Expo Router, TanStack Query,
React Hook Form + Zod, use-intl, Orval-generated API client. **One app with
role-aware capabilities**; a person can hold several roles, so never model
`user.role = fighter | coach | gym`. Backend: `../simplefit-api` (Phoenix).

## Non-negotiable rules

### Backend and API contract

1. **Phoenix owns business logic**: validation, authorization, pricing, state
   transitions, permissions. The app renders and calls the API; client checks
   are UX only.
2. **The backend OpenAPI artifact is canonical.** Contract changes originate
   in `simplefit-api`; consume them with `pnpm api:generate`.
3. **Never manually duplicate backend DTOs.** Use
   `@/shared/api/generated/model`; compose or narrow, never redefine.
4. **Never edit generated API code** (`src/shared/api/generated/`,
   `openapi/simplefit.api.json`). Regenerate, then `pnpm api:check`.
5. **No direct database access.** All data goes through the API transport;
   `fetch` is used only in `src/shared/api`.
6. API errors are `ApiError`: branch on `code`/`kind`, never on `message`.

### Architecture

7. Layers: `app → widgets → features → entities → shared` (the app layer is
   `src/app` + `src/providers`). Import only rightwards; no same-layer slice
   imports; one `index.ts` per slice; no other barrels; no placeholder domain
   slices.
8. **Route files stay thin**: render a widget; no business logic, no API calls.
9. **No speculative global state.** Server data lives in TanStack Query. **No
   Redux** by default; no Zustand or other store until a ticket proves a need.
10. Zod is for UX only; never reproduce backend business rules. Map backend
    `validation_error`s with `applyApiFieldErrors`.

### Storage and security

11. **SecureStore for sensitive device persistence** (tokens, credentials) via
    `@/shared/storage/secure-storage`. Never store secrets or tokens in
    AsyncStorage. SecureStore is not a general database.
12. **No secrets in `EXPO_PUBLIC_*` variables**: they are bundled and public.
    No secrets in source or Git. Read env only in `src/shared/config`.
13. Never log tokens, credentials or API request/response bodies.
14. TLS in production (`https://`); never disable certificate validation.
15. The backend is the authorization owner.

### i18n, locale, time zone, currency

16. **All user-facing copy uses i18n** (`src/shared/i18n/messages`,
    `useTranslations`). No hardcoded user-facing strings in product or
    reusable UI; primitives take labels as props.
17. Locales come only from `src/shared/i18n/locales.json`: `en` (default,
    final fallback), `ru`, `pl`, `de`, `uk`, `es`, `es-MX` (falls back to `es`),
    `fr`. Native names in the selector, never flags. Never geolocation.
18. **Locale, time zone and currency are independent.** Never infer currency
    or time zone (or country) from language. Currency codes come from data;
    format with `useFormatter`, never by hand.
19. English is the message schema: add new keys to `en` and every full catalog
    in the same change; only real Mexican differences go into `es-MX`. Never
    write copy for screens that do not exist.

### UI quality

20. **Accessibility is mandatory**: roles, labels, states, headers, live
    regions, 44 pt touch targets, font scaling; never colour alone.
21. **Utility-first styling.** Static styling (spacing, layout, alignment,
    borders, radius, colours, typography, static positioning) uses NativeWind
    `className` with semantic token classes (`bg-surface`,
    `text-muted-foreground`, `border-border`), never raw colours. Do not create
    `StyleSheet.create` blocks or static inline style objects for ordinary
    styling (ESLint enforces this). `style` is only for Reanimated/gesture
    styles, runtime-calculated values (insets, dynamic dimensions), NativeWind
    `vars()`, native props and third-party components without className;
    combine as `className="…" style={dynamic}`. Justified exceptions need an
    inline `eslint-disable-next-line no-restricted-syntax -- <reason>`. No
    CSS-in-JS, no styled-components, no style-constant modules. No web-only
    libraries (shadcn DOM components, Radix) in React Native.
22. Respect safe areas, keyboard and platform conventions (see the screen
    composition section of the architecture doc).

### Code quality

23. Strict TypeScript: no `any`, no `@ts-ignore`, no silencing lint/type
    errors.
24. **Tests accompany meaningful behaviour** (Jest + RNTL): query by role and
    accessible name; mock the network at `fetch`.
25. **Dependencies require justification**: current problem, why existing
    tools fall short, maintenance, license, Expo SDK compatibility
    (`pnpm expo:check`, `pnpm expo:doctor`). Pin exact versions; respect the pnpm
    release-age gate; review install scripts in `pnpm-workspace.yaml`; update
    the dependency list in the architecture doc. Do not add fake providers or
    abstractions without a real consumer.

### Git and Jira

26. **A Jira key is required in every commit:**
    `<type>: SF-<n> - <description>`, e.g. `feat: SF-12 - add mobile platform foundation`.
    Types: feat, fix, refactor, perf, test, docs, build, ci, chore, revert.
    Never bypass hooks (`--no-verify`).
27. **Future work uses ticket branches + PRs**: `feature|fix|chore/SF-<id>-description`,
    PR title `SF-12 — Mobile Platform Foundation`. Never push to `main`
    directly; never rewrite published history; never merge failing checks.

## Commands

```bash
pnpm install          # Node 24 (.nvmrc) + pnpm 12 (corepack); installs git hooks
pnpm ios | android    # development build on simulator/emulator (Xcode 26+ for iOS)
pnpm start            # Metro
pnpm quality          # lint, format, typecheck, test, api:check, expo checks, doctor, bundles
pnpm api:generate     # sync backend OpenAPI snapshot + regenerate client
```

**Definition of done:** `pnpm quality` passes, behaviour is tested, all
user-facing copy is translated for every locale, the generated client is
current, docs are updated when a convention or dependency changed, and native
behaviour was checked on a simulator/emulator when the change touches it.
