# Mobile Fighter registration (SF-39)

The production `mobile.onboarding.fighter` route against Claude Design section
**FIGHTER · 2 · Registration · mobile · 11 steps** (version `1791543685-48be`,
390 × 844), on the SF-25 FighterProfile
(`getMyFighterProfile`, `updateMyFighterProfile`, `completeFighterOnboarding`)
and the SF-45 entry resolver.

## Inventory

| Artboard           | Source                    | `?step=`        | Production         | Backend                              | Status                                          |
| ------------------ | ------------------------- | --------------- | ------------------ | ------------------------------------ | ----------------------------------------------- |
| OF1 Account        | `OnbFProfile.dc.html`     | `account`       | `AccountStep`      | SF-25 name, username, country, city  | current; no avatar, no date of birth (decision) |
| OF2 Experience     | `OnbFExperience.dc.html`  | `experience`    | `ExperienceStep`   | SF-25 level, amateur bouts, stance   | current                                         |
| OF3 Goals          | `OnbFGoals.dc.html`       | `goals`         | `GoalsStep`        | SF-25 goals, next fight date / event | current                                         |
| OF4 Weight class   | `OnbFBody.dc.html`        | `weight`        | `WeightStep`       | SF-25 class, weight, height          | current                                         |
| OF5 Gym            | `OnbFGym.dc.html`         | `gym`           | `InfoStep`         | no gym domain                        | informational, records nothing (decision)       |
| OF6 Membership     | `OnbFMembership.dc.html`  | `membership`    | `InfoStep`         | no membership domain                 | informational, records nothing (decision)       |
| OF7 Coach          | `OnbFCoach.dc.html`       | `coach`         | `InfoStep`         | no coach domain                      | informational, records nothing (decision)       |
| OF8 Privacy        | `OnbFPrivacy.dc.html`     | `privacy`       | `InfoStep`         | no privacy settings                  | informational; weight "never public" (SF-25)    |
| OF9 Friends        | `OnbFFriends.dc.html`     | `friends`       | `InfoStep`         | no community domain                  | informational, records nothing (decision)       |
| OF10 Notifications | `OnbFPermissions.dc.html` | `notifications` | `InfoStep`, Finish | `completeFighterOnboarding`          | informational; Finish completes onboarding      |
| OF11 Ready         | `OnbFReady.dc.html`       | `complete`      | `CompleteStep`     | the completed profile                | real summary only (decision)                    |

Code: `entities/fighter-profile` (the profile query and its writes),
`features/fighter-onboarding` (step policy, form rules, step bodies),
`widgets/fighter-onboarding` (the screen), `shared/lib/countries` (the ISO
table), `shared/lib/date-input` (dates typed in the locale's order).

## Rules

- **The backend decides.** `?step=` is navigation only. The step shown is
  derived from the profile: the earliest step with a missing requirement,
  otherwise OF3 Goals (SF-25 keeps no wizard cursor). A link to a later step,
  `complete` or anything unknown resolves to that step, so no link skips a
  required one. Nothing is kept on the device.
- **Saving.** Continue on OF1–OF4 checks the step (UX only), sends only the
  fields changed there (`PATCH`, empty clears to `null`) and moves on once
  the backend kept them. The backend's stable codes become messages
  (`already_exists` → username taken, `invalid_format` on weight → one
  decimal). Weight is sent as typed, a decimal comma read as a point, never
  rounded; the next fight is a calendar date (`YYYY-MM-DD`).
- **Skip** (where drawn: OF3–OF7, OF9, OF10) moves on and leaves that step's
  unsaved edits behind. OF5–OF10 never record anything.
- **Completion.** Finish on OF10 calls `completeFighterOnboarding`; OF11 shows
  only after it succeeded, with the saved name, `@username`, experience,
  stance, weight class and city / country. A rejection names the missing
  section and offers its step; an incomplete account registration (SF-44)
  goes back through the entry to O04. "Go to SimpleFit" asks the SF-45 entry.
  A profile completed earlier never shows OF11 again: the route leaves for
  the entry.
- **Edits** live as a diff over the backend profile, so a refetch (the app
  returns to the foreground after the web client saved) updates untouched
  fields and keeps unsaved edits. A write's answer is used until the query
  delivers it, so the step decided right after a save sees the saved
  profile.
- **Countries.** Hermes has no `Intl.DisplayNames`, so the 249 officially
  assigned ISO 3166-1 codes the API accepts and their names in every app
  locale are generated from Node's ICU (`pnpm countries:generate`);
  `countries.test.ts` re-derives the table and fails when it is stale.
- **Keyboard (iOS).** The pinned action rides above the keyboard; a focused
  field is scrolled into view (also when focus moves while the keyboard is
  up); OF1's return key walks Name → Username → City; dragging the page
  dismisses the number pads.

## Verification

- Unit: `features/fighter-onboarding/model/model.test.ts` (resume policy,
  link correction, dirty-field patches, codes), `shared/lib/countries.test.ts`.
- Component: `widgets/fighter-onboarding/ui/fighter-onboarding-screen.test.tsx`
  against a fake SF-25 backend at `fetch` (each step, dirty-only saves, Skip,
  username taken, unrounded weight, resume, completion success / missing /
  account registration, completed elsewhere, load failure, Back to O05);
  `providers/router.test.tsx` (the real route tree renders OF1, keeping the
  intent).
- iOS development build (EAS simulator build, unchanged native code) on
  iPhone 14 (390 × 844), iPhone 13 mini (375 × 812) and iPhone 15 Plus
  (430 × 932), iOS 18.5, against a local Phoenix and PostgreSQL (no mocks):
  sign-up with the real email code → O04 → O05 Fighter → OF1–OF11 → SF-45 →
  Fighter home; values checked in the database (`73.8`, `2027-03-14`);
  unrounded `73.85` rejected with `invalid_format`; a cold restart resumed at
  the earliest missing step and, once completed, opened Fighter home.
- Not verified: Android on a device or emulator (none here), VoiceOver /
  TalkBack passes.
