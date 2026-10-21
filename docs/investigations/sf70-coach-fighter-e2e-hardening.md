# SF-70: Coach–Fighter end-to-end hardening (mobile summary)

The full report, with the coverage matrix, defects and verdicts, is in
simplefit-platform `docs/investigations/sf70-coach-fighter-e2e-hardening.md`.
The mobile-specific points:

- **D1 (P1, fixed, verified in the app binary).** API responses, the refresh
  response with both tokens included, were stored in
  `Library/Caches/com.simplefit.boxing/Cache.db`, outside SecureStore. They
  were written through the `expo/fetch` session's shared `URLCache`, and in
  debug dev-client builds through Expo's network inspector, which stores even
  `no-store` answers.

  `modules/sensitive-http-cache` sets an `.ephemeral`, cache-less `expo/fetch`
  session before React Native starts and purges the old cache once, behind a
  versioned marker. EAS build `9d7292f8` (commit `762eb91`) was installed over
  affected installs. The session was kept, the old cache purged (`purge
purged`, then `alreadyDone`), and no token, email or title bytes reached the
  cache across sign-in, refresh rotation, lost-response recovery,
  offline/retry, invitation acceptance, logout, account switch, a revoked
  session and cold restarts.

- **D2 (verified).** In the same build the native date and time pickers
  passed: a normal date, Warsaw's repeated hour (choice of offset) and skipped
  hour (blocked), editing, dismissing, and display after a restart, at 375 and
  430 pt.
- **D10 (P2).** Invitation-resend toasts ("resent" and the cooldown message)
  do not appear on iOS.
- **D3 (fixed).** No ICU `plural` or `selectordinal` remains in any catalog,
  because Hermes has no `Intl.PluralRules`. `src/shared/i18n/hermes-plural.test.ts`
  enforces it.
- **D5 (P3).** At accessibility XL, Training keeps stale heights until the app
  is relaunched.
- Android and manual VoiceOver/TalkBack are NOT VERIFIED.
