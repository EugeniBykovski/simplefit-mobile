# Design system (mobile)

The SimpleFit mobile design system foundation (SF-13). The web follows the
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
(Visual System 2026). The two clients share the language (token names,
values, type scale, spacing, radius, component behaviour), not code: web uses
Tailwind CSS 4 + shadcn/Radix, mobile uses NativeWind + React Native
primitives.

Principles that shape every component:

- **Dark first.** Dark is the default theme; light is available and switchable.
- **Olive = action and progress.** One olive (primary) call to action per
  screen. Secondary actions are bone/graphite, outline or ghost.
- **Amber = attention, coral = failure.** Signals are used only for status;
  never decoration. Status is never colour alone (text and/or icon too).
- **Calm surfaces.** Graphite layers (`background` → `surface` →
  `surface-elevated`) separated by hairline `border`s rather than shadows.
- **Cards 22 pt/px radius**, controls 14, pills full.
- **Skeletons for waits longer than ~300 ms**; spinners for short or
  indeterminate actions (button loading).
- **Gym mode:** primary in-workout controls use 60 pt targets (`gym` button
  size on mobile).

## Token architecture

Two layers, with **identical names and values on both platforms**:

1. **Raw palette** (brand primitives): graphite 950/925/900/850/800/700, bone
   (and 50/200/300/400), stone 500/600/700, olive 200/300/400/600/700/900,
   amber (+700, tints), coral (+600/700, tints). Documented brand values:
   graphite 950 `#111312`, 900 `#181B19`, 850 `#1F2320`, 700 `#2E332F`; bone
   `#EDEFE7`; olive 200 `#E4EAB8`, 300 `#C9D17E`, 400 `#AEB95A`, 600 `#4E5626`,
   900 `#262815`; amber `#E2A250`; coral `#DF7A5E`. Other steps are derived for
   surfaces and contrast; they are not new brand colours. **Raw values are
   referenced only in the token file.**
2. **Semantic tokens** (what components use):

| Token                                                                                         | Purpose                                     |
| --------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `background` / `foreground`                                                                   | page and default text                       |
| `surface` (+`-foreground`), `surface-subtle`, `surface-elevated`                              | cards, wells/inputs, dialogs and popovers   |
| `muted` / `muted-foreground`                                                                  | quiet fills, secondary text                 |
| `border`, `input`, `ring`                                                                     | hairlines, control borders, focus indicator |
| `overlay`                                                                                     | modal scrim                                 |
| `primary` / `primary-foreground`                                                              | the one olive call to action                |
| `secondary` / `secondary-foreground`                                                          | high-contrast neutral action                |
| `accent` / `accent-foreground`                                                                | quiet selection, chips                      |
| `destructive`, `success`, `warning`, `info` (+`-foreground`, `-subtle`, `-subtle-foreground`) | status: solid and tinted                    |

Light values are derived from the same ramps. Every text/background pair
components render meets **WCAG AA (4.5:1)** in both themes and `ring` meets
3:1; a unit test computes the ratios from the token values, so a token change
that breaks contrast fails CI.

**Type scale** (families: Unbounded for display and numbers, Manrope for UI,
JetBrains Mono for uppercase labels):

| Style     | Size / line | Family                         |
| --------- | ----------- | ------------------------------ |
| `display` | 44 / 48     | Unbounded Bold, tight tracking |
| `h1`      | 32 / 36     | Unbounded Bold                 |
| `h2`      | 24 / 29     | Unbounded SemiBold             |
| `h3`      | 20 / 26     | Manrope Bold                   |
| `title`   | 17 / 24     | Manrope Bold                   |
| `body`    | 16 / 23     | Manrope Regular                |
| `body-sm` | 14 / 20     | Manrope Regular                |
| `label`   | 11 / 14     | JetBrains Mono, uppercase      |
| `caption` | 12 / 16     | Manrope Medium                 |

**Spacing** is Tailwind's 4-based scale; use the steps 1, 1.5, 2, 3, 4, 5, 6,
8, 10, 12, 16 (no arbitrary values). **Radius:** `xs` 6, `sm` 10, `md` 14
(controls), `lg` 18, `xl` 22 (cards), `2xl` 28 (dialogs/sheets), `full`
(pills, avatars). **Elevation** is semantic: surfaces and borders first;
shadows (web: `shadow-raised`, `shadow-overlay`, `shadow-modal`) only for
floating layers. **Motion:** short (150 ms) colour/opacity transitions; no
decorative animation; reduced motion respected.

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
- `tailwind.config.js`: `theme.colors` is **replaced** (only `transparent` and
  the semantic tokens exist) as `rgb(var(--color-<name>) / <alpha-value>)`;
  radius, font families (one per weight: `font-display`,
  `font-display-semibold`, `font-sans`, `font-sans-medium|semibold|bold`,
  `font-mono`), type scale (`text-display` … `text-caption`), tracking and
  touch targets (`min-h-touch` 44, `min-h-touch-gym` 60). A test keeps it in
  sync with the palettes.
- `src/shared/styles/theme.tsx`: `ThemeProvider` (preference `dark` default,
  `light` or `system`, persisted in preferences), `useTheme()` and `ThemeRoot`
  (applies the variables).
- `src/providers/fonts.ts`: the 7 bundled font files (`@expo-google-fonts`,
  per-weight imports so unused weights are not bundled), loaded behind the
  splash screen; on failure the app falls back to the system font.

**Theme.** `features/switch-theme` (`ThemeSelector`, translated) on the home
screen and in the gallery. The status bar and navigation theme follow the
resolved scheme.

**Rules**

- NativeWind `className` with semantic token classes. ESLint rejects
  `StyleSheet.create`, static inline style objects and **any string in a
  component file containing a hex value, arbitrary colour or palette class**
  (variant maps keep class names outside `className`).
- Use `<Text variant>` for typography; `weight` for a heavier Manrope weight.
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

| Primitive                             | Notes                                                                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Text`                                | `display`, `h1`–`h3` (exposed as headers), `title`, `body`, `bodySmall`, `label`, `caption`; `color`, `weight`; scaling up to 2×                |
| `Button`                              | `primary`, `secondary`, `outline`, `ghost`, `destructive`; sizes `sm`, `md` (44), `lg`, `gym` (60); `loading` (busy), `disabled`, Lucide `icon` |
| `Input`, `Textarea`                   | labelled; description as hint; error announced and shown by text + border                                                                       |
| `Checkbox`                            | `checkbox` role with checked/disabled state; check mark, not colour alone                                                                       |
| `RadioGroup`                          | radios with checked state; icon + weight                                                                                                        |
| `Switch`                              | native switch, labelled, token track/thumb                                                                                                      |
| `SegmentedControl`                    | tabs: `tablist` / `tab` with selected state                                                                                                     |
| `Badge`                               | same variants as web (minus `outline`); optional icon                                                                                           |
| `Avatar`                              | image or initials; accessible name is the person's name                                                                                         |
| `Card`                                | `surface`, radius `xl`; `elevated`                                                                                                              |
| `Separator`, `Skeleton`               | decorative, hidden from assistive tech; skeleton is static (no shimmer)                                                                         |
| `Spinner`                             | announced `progressbar` with label                                                                                                              |
| `Modal`                               | RN Modal, `overlay` scrim, `surface-elevated`; closes via button, backdrop, back/gesture; `closeLabel` required                                 |
| `Toast` (`ToastProvider`, `useToast`) | one at a time, 4 s, tap to dismiss; `alert` + `announceForAccessibility`; above the bottom inset                                                |
| `Screen`, `Icon`                      | safe-area frame; Lucide icon wrapper (decorative)                                                                                               |

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
`exp://127.0.0.1:8081/--/dev/design-system`). It shows typography, semantic
colours, all buttons and states, form controls, badges, avatars, cards,
loading states, modal and toasts, with the theme selector. Both the link and
the route are `__DEV__`-only (production redirects to `/`); developer-facing
and not translated by design.

## Testing

- `shared/styles/tokens.test.ts`: token contract in both themes, WCAG
  contrast, canonical values, Tailwind colours (no default palette), scales.
- `shared/styles/theme.test.tsx`: dark default, persistence, restore.
- `shared/ui/primitives.test.tsx`: roles, names, states and behaviour of
  every primitive (Button variants/loading/disabled/gym, Checkbox, Switch,
  RadioGroup, SegmentedControl, Badge, Avatar, Modal, Toast, Spinner).
- `features/switch-theme`, `widgets/design-system-gallery`: integration.
- Jest maps `lucide-react-native` to its CommonJS build (its React Native
  entry is untransformed ESM).
