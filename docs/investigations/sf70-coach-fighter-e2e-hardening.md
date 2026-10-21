# SF-70: Coach–Fighter end-to-end hardening (mobile summary)

The full report, with the coverage matrix, defects and verdicts, is in
simplefit-platform `docs/investigations/sf70-coach-fighter-e2e-hardening.md`.
The mobile-specific points:

- **D1 (P1; fixed, awaiting build verification).** API responses, the
  refresh response with both tokens included, were stored in
  `Library/Caches/com.simplefit.boxing/Cache.db`, outside SecureStore. The
  cache was written through two paths:
  - the `expo/fetch` session's shared `URLCache` (`private` answers);
  - in debug dev-client builds, Expo's network inspector, which stores even
    `no-store` answers.

  `modules/sensitive-http-cache` sets an `.ephemeral`, cache-less `expo/fetch`
  session before React Native starts and purges the old cache once, behind a
  versioned marker. It is proven on the iOS simulator with the module's own
  code, but not yet in a build of the app, which needs Xcode 26 or EAS. See
  the platform report, "D1 remediation", and
  `docs/architecture/README.md#http-transport`.

- **D2 (blocked).** The installed dev build predates
  `@react-native-community/datetimepicker`, so the native date and time pickers
  could not be exercised. A new build needs Xcode 26+ or EAS.
- **D3 (fixed).** No ICU `plural` or `selectordinal` remains in any catalog,
  because Hermes has no `Intl.PluralRules`. `src/shared/i18n/hermes-plural.test.ts`
  enforces it.
- **D5 (P3).** At accessibility XL, Training keeps stale heights until the app
  is relaunched.
- Android and manual VoiceOver/TalkBack are NOT VERIFIED.
