# Mobile authentication and account entry (SF-24, SF-37)

The production mobile.auth screens against Claude Design section **1a ·
Registration · start — mobile app (all roles)** (version `1791543685-48be`,
390 × 844), on the SF-21–SF-23 sign-in methods, the SF-20 session, SF-44
account registration and SF-45 entry resolution.

## Inventory

| Artboard               | Source                | Route                    | Production                                   | Backend                    | Status                                     |
| ---------------------- | --------------------- | ------------------------ | -------------------------------------------- | -------------------------- | ------------------------------------------ |
| A01 Welcome            | `Welcome.dc.html`     | `mobile.welcome`         | `WelcomeScreen` (SF-24)                      | SF-22, SF-23               | current                                    |
| O01b Sign in           | `Login.dc.html`       | `mobile.login`           | `LoginScreen` (SF-24)                        | SF-21–SF-23                | current; "Recover account" hidden          |
| O01c Sign-in code      | `SignInCode.dc.html`  | `mobile.login.code`      | `SignInCodeScreen` (SF-24)                   | SF-21 `email_sign_in`      | current                                    |
| O02 Create account     | `SignUp.dc.html`      | `mobile.signup`          | `SignUpScreen` (SF-24)                       | SF-21                      | current; full name presentational          |
| O03 Verify email       | `VerifyEmail.dc.html` | `mobile.signup.verify`   | `VerifyEmailScreen` (SF-24)                  | SF-21 `email_verification` | current                                    |
| O04 Basics & consent   | `Consent.dc.html`     | `mobile.signup.consent`  | `ConsentScreen`, `AccountBasicsForm` (SF-37) | SF-44                      | current (SF-44 fields, decision)           |
| O05 Choose your role   | `Onboarding.dc.html`  | `mobile.onboarding.role` | `RoleChoiceScreen` (SF-37)                   | SF-45                      | current (nothing preselected, decision)    |
| A03 Join with invite   | `JoinInvite.dc.html`  | `mobile.join._code`      | SF-33 placeholder                            | no invite domain           | deferred: no invite API, nothing faked     |
| A04 Workspace switcher | `Workspaces.dc.html`  | `mobile.workspaces`      | SF-33 placeholder                            | no workspace domain        | deferred: no real contexts, never an entry |

## Journey

Sign in (Google, Apple on iOS, or an email code) → the SF-20 session → the
SF-45 resolver (`GET /api/v1/me/entry`, with the URL's validated intent):

- account registration incomplete → **O04**;
- an explicit intent → that journey (Fighter onboarding, or Fighter home once
  complete; Coach / Gym onboarding; Sponsor → O05, whose Sponsor choice opens
  the web partner application);
- no intent: an in-progress Fighter resumes, a completed one goes home,
  otherwise **O05**.

`OnboardingGate` keeps the order: role onboarding before registration goes
to O04 (with the continuation); O04 shows only while registration is
incomplete; O05 only for a destination that maps to it. Nothing defaults to
Fighter, nothing is stored from an intent, no role, profile or workspace is
created by a choice.

## O04 Basics & consent

- Fields: full name, date of birth, Terms of Service and Privacy Policy
  (required), product news (optional). The artboard's contact-sport notice is
  not a global requirement (ADR 0016); full name is asked here because O02's
  email registration cannot store it and Google / Apple users never see O02.
- The date is typed as digits in the locale's day / month / year order (no
  native picker module: adding one would change the native build) and sent as
  a calendar date, so no time zone can move it.
- Required consents start unticked; a current accepted version stays ticked
  and locked (it cannot be withdrawn here). Only intentional edits are sent;
  the server checks every requirement (16 or older, current versions) and
  completion is permanent.
- The Terms and Privacy documents (SF-48) are not published: their names are
  not links, and a note says so.
- No back button (a signed-in person cannot return to sign-up); the
  artboard's "download or delete your data" line waits for that feature.

## O05 Choose your role

Four journeys as radios, none picked by default (an explicit
`intent=sponsor` preselects Sponsor / Brand). Continue asks the resolver
with the chosen intent and pushes where it answers; a failure stays with a
message and can be retried; a destination this version does not map is a
failure, never a guess. Sponsor opens `EXPO_PUBLIC_WEB_URL/partners/apply`
(without that variable the app says the hand-off is unavailable). The invite
links ("Have an invite?", "Use your staff invite") wait for A03.

## Native configuration

- EAS project `7564849d-49f1-4356-af4d-5ab2f3188299`, bundle / package
  `com.simplefit.boxing`, scheme `simplefit`, owner `yauhenibykouski`.
- The Android splash theme references `@drawable/splashscreen_logo`, which
  `expo-splash-screen` only generates from an image; with no splash artwork
  designed yet the first native Android build failed at resource linking.
  `assets/splash/splashscreen-logo-empty.xml` (an empty vector) resolves it
  and keeps the colour-only splash.
- Local native builds need Xcode 26+ (this Mac has 16.4) and an Android SDK;
  the development builds were made on EAS.

## Verification (SF-37)

- Unit and component: `features/account-registration/model/form.test.ts`,
  `widgets/auth-screens/ui/account-entry-screens.test.tsx` (O04 and O05
  against a mocked API), `shared/api/http/api-error.test.ts` (`fieldCodes`),
  `shared/config/env.test.ts` (web URL), `providers/router.test.tsx` (the real
  route tree: O04 / O05 gate rules, intent, sponsor).
- Development builds: iOS simulator (EAS `development-simulator`) installed on
  an iPhone 14 simulator (390 × 844, iOS 18.5); Android APK (EAS
  `development`) built, not run (no emulator here).
- On the iOS build against a local Phoenix and PostgreSQL (no mocks): Welcome →
  Create account → the real verification code → session → SF-45 → O04
  (under-16 rejected, completed) → O05 → Fighter onboarding route; a cold
  restart restored the session (refresh rotation) and resolved O05 again;
  Sponsor opened the web partner application; Google's native SDK opened the
  system sign-in, cancelling returned to idle.
- Not verified: a full Google or Apple sign-in through backend verification
  (needs a test account and the API's provider client IDs), Android on a
  device or emulator, TalkBack / VoiceOver passes.
