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
  derived from the profile (the resume policy below). A link to a later
  step, `complete` or anything unknown resolves to that step, so no link
  skips a required one. Nothing is kept on the device.
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

## Integration and lifecycle (SF-26)

The journey runs on the SF-45 resolver and the existing gates; SF-26 adds no
second decision matrix and no wizard state:

- **Entry.** Signed in → `GET /api/v1/me/entry` (root `EntryRedirect`) →
  `account_registration` → O04, whatever the intent or link
  (`OnboardingGate`); `fighter_onboarding` → this route; `fighter_home` → the
  Fighter app; no intent and no Fighter state → O05 (never Fighter by
  default). Nothing is created before the first OF1 save.
- **Resume policy** (`resumeStep`, backend data only): the earliest step with
  a missing requirement (OF1, then OF2); otherwise the step after the
  furthest optional step with saved data: OF5 once any OF4 field is saved,
  OF4 once any OF3 field is saved, otherwise OF3. OF5–OF10 record nothing, so
  a person who stopped at OF7 or OF9 resumes at OF5: the last screen visited
  is never claimed. From any resume step the flow reaches Finish (OF10), the
  only completion action; a profile with every requirement saved can always
  finish. SF-25 has no wizard cursor, and none is added.
- **Completed elsewhere.** A profile completed on another client leaves the
  route for the entry (Fighter home), including on `?step=complete`; OF11 is
  shown only in the session whose Finish the backend confirmed. A cached
  profile is never used to decide a step before a fresh read after mount.
- **Completion.** Finish calls `completeFighterOnboarding` once at a time
  (the action is busy while it runs). If the server completed but the answer
  was lost, the person sees a retry; finishing again is safe (idempotent,
  `completed_at` kept), and a refetch alone leads to Fighter home. "Go to
  SimpleFit" (and Android Back on OF11) asks the entry again; an entry
  failure shows the retry screen and never undoes completion.
- **Edits and other clients.** Unsaved edits are kept over refetches (app
  foreground, reconnect); untouched fields take the newer server value; a
  save sends only the fields changed here. The same field edited on two
  clients is last-write-wins: SF-25 has no version or ETag, so no conflict
  is detected.
- **Session.** Token refresh, rotation and revocation are SF-20/SF-24's
  (`callWithSession`); a revoked session returns to sign-in, after which the
  route resumes from the backend (unsaved edits are lost). The query cache
  is cleared when the session ends or another user signs in on the device
  (`providers/session-cache.ts`).
- **Navigation.** Steps share one screen (`setParams`): the header's Back
  and Android Back walk the steps; iOS swipe-back is enabled only on OF1,
  where Back leaves the flow too.
- **After completion.** Fighter home is still the SF-33 placeholder: the
  Mobile First-Run (SF-41) attaches there. Nothing marks a first run.

## Verification

- Unit: `features/fighter-onboarding/model/model.test.ts` (resume policy,
  link correction, dirty-field patches, codes), `shared/lib/countries.test.ts`.
- Component: `widgets/fighter-onboarding/ui/fighter-onboarding-screen.test.tsx`
  against a fake SF-25 backend at `fetch` (each step, dirty-only saves, Skip,
  username taken, unrounded weight, resume, completion success / missing /
  account registration, completed elsewhere, load failure, Back to O05);
  `providers/router.test.tsx` (the real route tree renders OF1, keeping the
  intent).
- SF-26: resume cases in `model.test.ts`; lifecycle in the screen test
  (resume after saved data, completed on another client, unsaved edit over
  another client's change, lost completion answer, Android Back on OF11);
  entry scenarios A–C in `router.test.tsx` (new Fighter → OF1, partial →
  OF2, completed + old link → Fighter home); `providers/session-cache.test.tsx`.
- iOS development build (EAS simulator build, unchanged native code) on
  iPhone 14 (390 × 844), iPhone 13 mini (375 × 812) and iPhone 15 Plus
  (430 × 932), iOS 18.5, against a local Phoenix and PostgreSQL (no mocks):
  sign-up with the real email code → O04 → O05 Fighter → OF1–OF11 → SF-45 →
  Fighter home; values checked in the database (`73.8`, `2027-03-14`);
  unrounded `73.85` rejected with `invalid_format`; a cold restart resumed at
  the earliest missing step and, once completed, opened Fighter home.
- SF-26 smoke (iOS dev build, iPhone 14, local Phoenix + PostgreSQL, no
  mocks): email sign-up → O04 → O05 Fighter → OF1–OF2; cold restarts resumed
  at OF3 (nothing optional saved), OF4 (after OF3), OF5 (after OF4) and OF5
  again after stopping at OF9; `?step=complete` while incomplete opened the
  resume step; Finish → one `complete-onboarding` → OF11 → SF-45 → Fighter
  home; the old OF11 link and a cold restart opened Fighter home; a session
  revoked on the server returned to sign-in (refresh 401) and signing in
  again opened Fighter home. Database: one user, one Fighter profile,
  `completed_at` unchanged, no first-run outcome created.
- Not verified: Android on a device or emulator (none here), VoiceOver /
  TalkBack passes.
