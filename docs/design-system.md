# Design system (mobile)

The SimpleFit mobile design system foundation (SF-13, reconciled with the canonical design in SF-17). The web follows the
same language in `simplefit-platform/docs/design-system.md`.

**Design source.** Product screens are designed in the canonical Claude Design
artifact (https://claude.ai/artifact/JEsBg51MjX8KiHWEro8omY). How to
reference, read, translate and visually QA an artboard is in
`docs/design-handoff.md`. That document is the visual source of truth; this
one is the implementation source of truth. On mobile, design values become
semantic token classes, `<Text variant>` styles, Tailwind spacing/radius
steps, `src/shared/ui` primitives and `<Icon>` (`lucide-react-native`). Known
gaps between the design and these tokens are tracked in
`docs/design-reconciliation.md`.

## Design language

SimpleFit uses one visual language on web and mobile, **Graphite × Olive**
(Visual System 2026). Its values were reconciled with the canonical Claude
Design artifact in SF-17 and are fixed in **`docs/design-tokens.json`**. That
file is the cross-platform contract: it is kept identical in both
repositories, and each repository's tests assert that its implementation
matches it. The two clients share the language (token names, values, type
roles, spacing, radius, control sizes, component behaviour), not code: web
uses Tailwind CSS 4 + shadcn/Radix, mobile uses NativeWind + React Native
primitives.

Principles that shape every component:

- **Dark first.** Dark is the default theme and the **canonical,
  pixel-faithful reference**: Claude Design draws only the dark product. The
  light theme is a supported production extension; its values are derived
  for legibility and AA contrast, not designed. Do not invent light-only
  designs. Until a canonical light design exists, light screens follow the
  dark composition with the light tokens.
- **Olive = action and progress.** One olive (primary) call to action per
  screen. Secondary actions are `quiet` (graphite), `secondary` (bone),
  `outline` or `ghost`.
- **Amber = attention, coral = failure.** Signals are used only for status,
  never decoration. Status is never colour alone (text and/or icon too).
- **Calm surfaces.** Graphite layers (`background` → `surface` →
  `surface-elevated`) separated by hairline `border`s rather than shadows.
- **Bento tiles:** one metric per tile, the number set big (`metric-*` roles).
- **Skeletons for waits longer than ~300 ms**; spinners for short or
  indeterminate actions (button loading).
- **Gym mode:** primary in-workout controls use 60 pt targets.

## Token architecture

Two layers, with **identical names and values on both platforms**:

1. **Raw palette** (`palette` in the contract), referenced only in the token
   file:
   - graphite 950–600, bone (+50/200/300/400), stone 500/550/600/650/700
   - olive 200–900 (incl. 350, 500, 800)
   - amber and coral, each with 200, tints and borders

   Canonical Styleguide values: graphite 950 `#111312`, 900 `#181B19`, 850
   `#1F2320`, 700 `#2E332F`; bone `#EDEFE7`; olive 200 `#E4EAB8`, 300
   `#C9D17E`, 400 `#AEB95A`, 600 `#4E5626`, 900 `#262B15`; amber `#E3A24F`;
   coral `#E07A5F`. Steps the Styleguide does not list come from the
   artboards (e.g. secondary text `#A7AD9F`, tertiary text `#848B80`) or are
   derived for the light theme.

2. **Semantic tokens** (what components use):

| Token                                                                                                    | Purpose                                                                             |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `background` / `foreground`                                                                              | Page and default text                                                               |
| `surface` (+`-foreground`), `surface-subtle`, `surface-elevated`                                         | Cards and fields, wells, quiet controls / dialogs / popovers                        |
| `muted` / `muted-foreground`                                                                             | Quiet fills; **secondary** text                                                     |
| `faint-foreground`                                                                                       | **Tertiary** text: metadata, helper copy, inactive icons                            |
| `border`, `border-strong`, `input`, `ring`                                                               | Hairlines, stronger dividers / handles, control borders, focus indicator            |
| `overlay`                                                                                                | Modal scrim                                                                         |
| `primary` / `primary-foreground`, `primary-muted`                                                        | The one olive call to action; olive mid-tone for outline borders and progress steps |
| `secondary` / `secondary-foreground`                                                                     | High-contrast neutral (bone) action, selected segment                               |
| `highlight` / `highlight-foreground`                                                                     | Olive text, links, kickers, active icons; olive emphasis fills (avatars, progress)  |
| `accent` / `accent-foreground`, `accent-muted-foreground`, `accent-strong`, `accent-border`              | Selection and olive-tinted surfaces, their secondary text, chips, their border      |
| `destructive`, `success`, `warning`, `info` (+`-foreground`, `-subtle`, `-subtle-foreground`, `-border`) | Status: solid, tinted, and the tinted surface's border                              |

Every text/background pair in `contrast.text` meets **WCAG AA (4.5:1)** in
both themes, and `ring` meets 3:1. The tests compute the ratios from the
token values, so a token change that breaks contrast fails CI. Where an
artboard uses a lower-contrast value (e.g. `#5B615C` meta text, 2.9:1),
production keeps the accessible token: an accessibility override.

**Type roles** are the only way to size text: no other font sizes exist. The
same roles exist on both platforms: web `type-<role>` utilities, mobile
`<Text variant>` in camelCase.

| Role                                               | Size / line                           | Family, weight                        | Use                                      |
| -------------------------------------------------- | ------------------------------------- | ------------------------------------- | ---------------------------------------- |
| `display`                                          | 44 / 48                               | Unbounded 600, −0.02em                | Hero                                     |
| `h1`                                               | 26 / 30                               | Unbounded 600, −0.02em                | Mobile screen title, email title         |
| `h2`                                               | 22 / 26                               | Unbounded 600, −0.02em                | Web page title, section title            |
| `h3`                                               | 19 / 24                               | Unbounded 600, −0.01em                | Sheet / modal / mobile section title     |
| `title`                                            | 15 / 20                               | Unbounded 600                         | Card and panel title                     |
| `metric-xl` · `metric-lg` · `metric` · `metric-sm` | 30 / 34 · 26 / 30 · 22 / 26 · 18 / 22 | Unbounded 700, −0.03em, tabular       | Bento numbers, prices, timers            |
| `body-lg`                                          | 15 / 22                               | Manrope 400                           | Primary mobile copy, mobile field values |
| `body`                                             | 14 / 21                               | Manrope 400                           | Mobile body copy                         |
| `body-sm`                                          | 13 / 20                               | Manrope 400                           | Web body copy, table rows, web controls  |
| `caption`                                          | 12 / 18                               | Manrope 400                           | Meta and helper text, field labels (700) |
| `micro`                                            | 11 / 16                               | Manrope 400                           | Small meta                               |
| `badge`                                            | 10 / 14                               | Manrope 800, uppercase                | Status pills                             |
| `label-lg`                                         | 11 / 16                               | JetBrains Mono 400, 0.16em, uppercase | Large kickers (web, email)               |
| `label`                                            | 10 / 14                               | JetBrains Mono 400, 0.14em, uppercase | Kickers, section labels, metadata        |

**Weights:** Unbounded 600 (headings) and 700 (metrics). Manrope 400 (role
default), 600 (field values), 700 (labels, names), 800 (emphasis and every
button label). JetBrains Mono 400. No other weights are loaded or allowed.

**Spacing** uses only these steps (Tailwind keys, 1 step = 4 px):

| Key | 0.5 | 1   | 1.5 | 2   | 2.5 | 3   | 3.5 | 4   | 4.5 | 5   | 5.5 | 6   | 8   | 10  | 12  | 14  | 16  | 20  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| px  | 2   | 4   | 6   | 8   | 10  | 12  | 14  | 16  | 18  | 20  | 22  | 24  | 32  | 40  | 48  | 56  | 64  | 80  |

The canonical design spaces in 2 px steps up to 24, then 32–64. 80 is the
public-website section rhythm. ESLint rejects other steps and arbitrary
values in product code.

**Radius** (`rounded-*`): `xs` 6 (marks), `sm` 9 (badges, small tiles),
`md` 12 (compact controls ≤ 48 px: web buttons and fields, chips), `lg` 16
(mobile fields, banners), `xl` 18 (primary CTAs 50–56 px), `2xl` 20 (compact
cards), `3xl` 22 (cards), `4xl` 28 (sheets, dialogs), `full` (pills, circles,
segmented controls, toggles).

**Controls** (`controls` in the contract):

|                     | Web                                                                      | Mobile                                             |
| ------------------- | ------------------------------------------------------------------------ | -------------------------------------------------- |
| Button `sm`         | 32, `md`, body-sm 800                                                    | 36 pill, body-sm 800, touch target extended to 44  |
| Button `md`         | 40, `md`, body-sm 800 (default)                                          | 50, `xl`, body 800 (default)                       |
| Button `lg`         | 48, `md`, body-sm 800                                                    | 56, `xl`, body-lg 800 (main action)                |
| Button `xl` / `gym` | `xl` 54, `xl`, body-lg 800 (hero, checkout)                              | `gym` 60, `2xl`, body-lg 800                       |
| Field               | 40, `md`, body-sm, `surface` well, hairline `border`, olive focus border | 54, `lg`, body-lg 600, same colours                |
| Field label         | caption 700, `muted-foreground`                                          | same                                               |
| Badge               | badge role, `sm`, padding 4 × 9                                          | same                                               |
| Card                | `3xl`, padding 18 × 20; compact `2xl`, 14 × 16                           | same                                               |
| Switch              | 44 × 26                                                                  | native switch (platform convention), token colours |

Button variants on both platforms: `primary`, `secondary`, `quiet`,
`outline`, `ghost`, `destructive`, `destructive-subtle` (mobile
`destructiveSubtle`); web adds `link`. Web and mobile heights differ on
purpose: pointer versus touch.

**Elevation** is semantic: surfaces and borders first; shadows (web:
`shadow-raised`, `shadow-overlay`, `shadow-modal`) only for floating layers.
**Motion:** short (150 ms) colour/opacity transitions; no decorative
animation in product UI; reduced motion respected. **Exception (SF-34):** the
approved system states of Claude Design section 35 carry their designed
motion (logo ring, corner posts, drawn "S", glow, segments, shimmer), built
with `Animated` and stopped when the system reduces motion.

**System-state typography (SF-34):** `<Text variant>` `hero` (28/30),
`wordmark` (36/34), `numeral` (112), `numeralKo` (92), `labelWide` (11 mono
600, 0.62 em), `countWord` (12 mono, 0.3 em) from
`typography.systemRoles.mobile` in `docs/design-tokens.json`; only for launch,
404 and error states. Mono 600 (`JetBrainsMono_600SemiBold`, `weight="semibold"`
on mono roles) and the product role `brand` (13 px wordmark) are part of the
contract; `Button` gains the `warning` variant and the 44 pt `system` size
(the System states sheet's card action).

## Accessibility

- Every interactive primitive has a role, an accessible name (labels are
  props, never built-in copy), and reports disabled/checked/selected/busy
  state.
- Visible focus (web `focus-visible` ring using `ring`), 44 pt minimum touch
  targets on mobile (60 pt gym mode).
- Errors are announced (live region / `alert`) and shown by text plus border,
  never colour alone; status badges always carry a text label.
- Text scales with the user's font size (mobile up to 2×).
- Contrast is tested (see above).

## How domain components consume the system

Feature and widget components compose primitives from `shared/ui` and style
layout with semantic token classes. They do not:

- use raw colours, hex values, arbitrary colour values or palette names
  (ESLint rejects them),
- restyle a primitive's colours from outside (add a variant to the primitive
  instead, if a real screen needs it),
- add copy to primitives (pass translated labels as props).

Add a variant or a new primitive only when a real screen needs it, with a test
and an entry in the gallery.

## Mobile implementation

**Files**

- `src/shared/styles/tokens.ts`: `rawPalette` and `palettes.dark` /
  `palettes.light` (camelCase semantic names, e.g. `surfaceElevated`),
  `themeVariables()` (NativeWind `vars()`).
- `tailwind.config.js`: `theme.colors`, `theme.fontSize` and
  `theme.borderRadius` are **replaced**.
  - Only `transparent` and the semantic tokens exist as colours,
    `rgb(var(--color-<name>) / <alpha-value>)`.
  - Only the contract's type roles and radius scale exist.
  - It adds:
    - font families, one per weight: `font-display` (Unbounded 600),
      `font-display-bold`, `font-sans`, `font-sans-semibold|bold|extrabold`,
      `font-mono`
    - per-role letter spacing in px
    - spacing steps `4.5`/`5.5`
    - control heights: `min-h-button-sm|md|lg`, `min-h-field`, `min-h-touch`
      44, `min-h-touch-gym` 60
  - A test keeps it in sync with `docs/design-tokens.json`.
- `metro.config.js`: NativeWind `inlineRem: 16`. Tailwind's spacing is
  defined in rem and NativeWind defaults to 1 rem = 14 pt on native, which
  rendered every SF-13 spacing step 12.5% smaller than the web. 16 makes
  mobile pixel-identical to the contract.
- `src/shared/styles/theme.tsx`: `ThemeProvider` (preference `dark` default,
  `light` or `system`, persisted in preferences), `useTheme()` and `ThemeRoot`
  (applies the variables).
- `src/providers/fonts.ts`: the 7 bundled font files, exactly the contract's
  weights: Unbounded 600/700, Manrope 400/600/700/800, JetBrains Mono 400.
  `@expo-google-fonts` per-weight imports, so unused weights are not bundled.
  Loaded behind the splash screen; on failure the app falls back to the
  system font.

**Theme.** `features/switch-theme` (`ThemeSelector`, translated) on the home
screen and in the gallery. The status bar and navigation theme follow the
resolved scheme.

**Rules**

- NativeWind `className` with semantic token classes. ESLint rejects
  `StyleSheet.create`, static inline style objects and **any string in a
  component file containing a hex value, arbitrary colour or palette class**
  (variant maps keep class names outside `className`).
- Use `<Text variant>` for typography: the contract's roles in camelCase
  (`metricLg`, `bodySm`, `labelLg`). `weight` (`semibold`, `bold`,
  `extrabold`) raises a Manrope role.
  - ESLint rejects:
    - Tailwind's default sizes, weights, leading and tracking classes
    - bare `rounded`
    - arbitrary spacing, radius and type values
    - spacing steps outside the scale
  - Primitives in `src/shared/ui` are exempt only from the last two.
- Conditional classes are literal strings so Tailwind sees them.
- **Dynamic `style` is allowed** only for runtime values: safe-area insets
  (Screen, Toast), the theme's `vars()` (ThemeRoot), Reanimated/gesture
  styles, a colour being documented (gallery swatches), and third-party views
  without className. **Native colour props** (icon colour, `ActivityIndicator`,
  `Switch` track/thumb, `placeholderTextColor`, navigation theme) read
  `useTheme().colors`.
- Opacity of the `overlay` scrim is applied by the component
  (`bg-overlay/70`).

**Primitives** (`src/shared/ui`):

| Primitive                             | Notes                                                                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Text`                                | The 17 type roles (`display`, `h1`–`h3` exposed as headers, `title`, `metric*`, `bodyLg`, `body`, `bodySm`, `caption`, `micro`, `badge`, `labelLg`, `label`); `color`, `weight`; scaling up to 2×                        |
| `Button`                              | `primary`, `secondary`, `quiet`, `outline`, `ghost`, `destructive`, `destructiveSubtle`. Sizes `sm` 36 pill (hitSlop to 44), `md` 50, `lg` 56, `gym` 60. Labels Manrope 800. `loading` (busy), `disabled`, Lucide `icon` |
| `Input`, `Textarea`                   | 54 pt, radius `lg`, body-lg 600 on `surface`, hairline `border`, olive border when focused. Label caption 700 muted; description as hint; error announced and shown by text + border                                     |
| `Checkbox`                            | `checkbox` role with checked/disabled state; check mark, not colour alone                                                                                                                                                |
| `RadioGroup`                          | Radios with checked state; icon + weight                                                                                                                                                                                 |
| `Switch`                              | Native switch (platform convention), labelled, token track/thumb                                                                                                                                                         |
| `SegmentedControl`                    | Tabs: `tablist` / `tab` with selected state; pill track, selected segment `secondary` (bone) 800                                                                                                                         |
| `Badge`                               | Same variants as web (minus `outline`); `badge` role, radius `sm`; optional icon                                                                                                                                         |
| `Avatar`                              | Image or initials on `highlight`; accessible name is the person's name                                                                                                                                                   |
| `Card`                                | `surface`, radius `3xl`, 18 × 20; `compact`: `2xl`, 14 × 16; `elevated`                                                                                                                                                  |
| `Separator`, `Skeleton`               | Decorative, hidden from assistive tech; skeleton is static (no shimmer)                                                                                                                                                  |
| `Spinner`                             | Announced `progressbar` with label                                                                                                                                                                                       |
| `Modal`                               | RN Modal, `overlay` scrim, `surface-elevated`, radius `4xl`; closes via button, backdrop, back/gesture; `closeLabel` required                                                                                            |
| `Toast` (`ToastProvider`, `useToast`) | One at a time, 4 s, tap to dismiss; `alert` + `announceForAccessibility`; above the bottom inset                                                                                                                         |
| `Screen`, `Icon`                      | Safe-area frame; Lucide icon wrapper (decorative)                                                                                                                                                                        |

**BottomSheet is deferred:** a good native sheet needs
`@gorhom/bottom-sheet` (Reanimated + Gesture Handler). Add it with the first
screen that needs a sheet; use `Modal` until then.

**Icons:** `lucide-react-native` only (the same set as web's `lucide-react`;
SVG via `react-native-svg`). Use `<Icon icon={Name} color="token" />`; icons
are decorative.

## Gallery

In a development build or Expo Go (`pnpm start`), tap **Design system
gallery** at the bottom of the home screen, or open the deep link
`simplefit://dev/design-system` (Expo Go:
`exp://127.0.0.1:8081/--/dev/design-system`). It shows every type role and
weight, the semantic colours, the spacing and radius scales, every button
variant, size and state, form controls, badges, avatars, default and compact
cards, loading states, modal and toasts, with the theme selector. Both the link and
the route are `__DEV__`-only (production redirects to `/`); developer-facing
and not translated by design.

## Testing

- `shared/styles/tokens.test.ts`: `tokens.ts` and `tailwind.config.js`
  match `docs/design-tokens.json`: palette, every semantic token in both
  themes, the contract's WCAG pairs, type roles and tracking, radius, spacing
  (including Metro's `inlineRem: 16`) and control heights.
- `providers/fonts.test.ts`: the bundled fonts are exactly the contract's
  weights, and every font family class points at a bundled font.
- `shared/styles/theme.test.tsx`: dark default, persistence, restore.
- `shared/ui/primitives.test.tsx`: roles, names, states and behaviour of
  every primitive (Text roles and weights, Button variants and canonical
  sizes, loading/disabled, the 44 pt small-button target, Checkbox, Switch,
  RadioGroup, SegmentedControl, Badge, Avatar, Modal, Toast, Spinner).
- `features/switch-theme`, `widgets/design-system-gallery`: integration.
- Jest maps `lucide-react-native` to its CommonJS build (its React Native
  entry is untransformed ESM).
