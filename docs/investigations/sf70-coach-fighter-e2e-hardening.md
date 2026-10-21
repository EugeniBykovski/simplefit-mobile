# SF-70: Coach–Fighter end-to-end hardening (mobile summary)

The full report, with the coverage matrix, defects and verdicts, is in
simplefit-platform `docs/investigations/sf70-coach-fighter-e2e-hardening.md`.
The mobile-specific points:

- **D1 (P1, open, needs approval).** On iOS, React Native's networking uses the
  default `NSURLSession`. Its shared `NSURLCache` wrote the sign-in response,
  which holds the access and refresh tokens, to
  `Library/Caches/com.simplefit.boxing/Cache.db`. It did so even with
  `Cache-Control: no-store` from the API. The tokens therefore live outside
  SecureStore. The fix needs native configuration (a non-persistent session
  configuration through a config plugin, plus a one-time purge of the existing
  cache) and a new dev build.
- **D2 (blocked).** The installed dev build predates
  `@react-native-community/datetimepicker`, so the native date and time pickers
  could not be exercised. A new build needs Xcode 26+ or EAS.
- **D3 (fixed).** No ICU `plural` or `selectordinal` remains in any catalog,
  because Hermes has no `Intl.PluralRules`. `src/shared/i18n/hermes-plural.test.ts`
  enforces it.
- **D5 (P3).** At accessibility XL, Training keeps stale heights until the app
  is relaunched.
- Android and manual VoiceOver/TalkBack are NOT VERIFIED.
