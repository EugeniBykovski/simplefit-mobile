# Mobile Coach registration (SF-53)

The production `mobile.onboarding.coach` route against Claude Design section
**COACH · 3 · Registration · mobile · 2 steps + complete** (Version 89,
`1791966129-8ecb`, 390 × 844), on the SF-50 CoachProfile
(`getMyCoachProfile`, `updateMyCoachProfile`, `completeMyCoachOnboarding`)
and the SF-51 entry (`resolveMyEntry`, `chooseMyEntryContext`).

## Design reconciliation

Up to version `1791965411-694c` the mobile Coach registration had eleven
steps (OC1–OC11) built on a model the backend does not have: years coaching
and a boxing background on OC1, formats mixed with competition levels and
Strength & Conditioning on OC2, credentials, business size, gym, plan and
trial, services, payouts, fighter invitations and coach data rules on
OC3–OC10, and a completion screen showing a trial, a licence under review,
services, payouts and an invite link. With approval, SF-53 reconciled OC1,
OC2, OC11 and the onboarding flow diagram in Claude Design (Version 89) to the
SF-50 contract and marked OC3–OC10 FUTURE (`D-MOBILE-COACH-ONBOARDING-FLOW`).
The same version publishes the WCR7 wording the web already uses ("Continue to
coach home", "Coach tools are not available yet").

## Inventory

| Artboard              | Source                    | `?step=`   | Production     | Backend                                                | Status                                       |
| --------------------- | ------------------------- | ---------- | -------------- | ------------------------------------------------------ | -------------------------------------------- |
| OC1 Coach profile     | `OnbCProfile.dc.html`     | `profile`  | `ProfileStep`  | SF-50 name, brand, country, city, bio, languages       | current (new, invalid, saving)               |
| OC2 Coaching type     | `OnbCType.dc.html`        | `type`     | `TypeStep`     | SF-50 coaching formats, competition levels; completion | current (ready, invalid, missing, finishing) |
| OC11 Complete         | `OnbCReady.dc.html`       | `complete` | `CompleteStep` | the completed profile; SF-51 context choice            | current (ready, opening, failure)            |
| OC3 Credentials       | `OnbCCredentials.dc.html` | —          | —              | needs the verification domain                          | FUTURE (DEFERRED)                            |
| OC4 Business size     | `OnbCSize.dc.html`        | —          | —              | needs the billing domain                               | FUTURE (DEFERRED)                            |
| OC5 Gym               | `OnbCWhere.dc.html`       | —          | —              | needs the Gym domain                                   | FUTURE (DEFERRED)                            |
| OC6 Plan              | `OnbCPlan.dc.html`        | —          | —              | needs the billing domain                               | FUTURE (DEFERRED)                            |
| OC7 Services          | `OnbCServices.dc.html`    | —          | —              | needs the services domain                              | FUTURE (DEFERRED)                            |
| OC8 Payouts           | `OnbCPayouts.dc.html`     | —          | —              | needs the payouts domain                               | FUTURE (DEFERRED)                            |
| OC9 Invite fighters   | `OnbCInvite.dc.html`      | —          | —              | needs coaching relationships                           | FUTURE (DEFERRED)                            |
| OC10 Coach data rules | `OnbCPrivacy.dc.html`     | —          | —              | needs privacy sharing                                  | FUTURE (DEFERRED)                            |

Code: `entities/coach-profile` (the profile query and its writes),
`features/coach-onboarding` (step policy, form rules, step bodies),
`widgets/coach-onboarding` (the screen), `features/session-gate`
(`CapabilityGate`, `chooseEntryContext`). The registration controls shared
with the Fighter registration live in `shared/ui` (`ChoiceCard`, `Chip`,
`CountryField`, `FieldError`, `FieldFocus`).

## Rules

- **The backend decides.** `?step=` is navigation only. Without a step, or
  with `complete`, a FUTURE step or garbage on an unfinished profile, the
  route opens the earliest step with a missing requirement (OC1 for coach
  name, country or city; otherwise OC2). Both form steps stay editable;
  neither completes anything. Nothing is kept on the device.
- **Fields and vocabularies** are the generated SF-50 contract: coach name
  (required, 1–60), brand (optional, 1–80), country (required, the shared
  ISO 3166-1 list), city (required, 1–80), bio (optional, up to 500, line
  breaks kept), coaching languages (`en pl ru be uk`, native names, stored
  as codes), coaching formats (`personal_training`, `group_coaching`,
  `online_coaching`, `fight_camps`; at least one) and competition levels
  (`amateur`, `professional`; optional, a separate group). Lengths count code
  points, as the API does. Lists are kept in contract order and never repeat
  a value.
- **Saving.** Continue on OC1 checks the step (UX only), sends only the fields
  changed there (`PATCH`; empty text clears to `null`, an emptied list is
  `[]`) and moves on once the backend kept them. Finish on OC2 saves its
  changes, then calls `completeMyCoachOnboarding` once (the action is busy
  while it runs). The backend's stable `field_codes` become messages
  (`required`, `too_long`, `invalid_choice`, `invalid_format`, `invalid`);
  the first invalid field takes focus. A failed save keeps every value typed.
- **Account name.** For a new, unsaved profile (`not_started`, no coach name)
  OC1 offers the account's full name as the coach name and says so. It is a
  value of the form, saved only with the step; typing replaces it; a name
  saved elsewhere meanwhile replaces it while untouched; a saved coach name
  is never replaced; the account and the Fighter profile are never written.
- **Edits and other clients.** Edits live as a diff over the backend profile,
  so a refetch (the app returns to the foreground after the web client
  saved) updates untouched fields and keeps unsaved edits; a save sends only
  the fields changed here, so the other client's value is never reverted.
  The same field edited on two clients is last-write-wins (SF-50 has no
  version).
- **Completion.** OC11 shows only in the session whose Finish the backend
  confirmed, with the saved name, brand, place, formats, competition levels
  and languages, and says the coach tools are not available yet. A rejection
  naming coach-profile fields offers "Go to Coach profile"; a missing format
  marks the formats; an incomplete account registration goes back through
  the entry (O04) with the Coach intent. If the server completed but the
  answer was lost, Finish again is safe (idempotent). A profile completed
  elsewhere leaves the route through the entry with `intent=coach`.
- **Coach home.** "Continue to coach home" records the Coach context
  (`PUT /api/v1/me/entry/context`, SF-51) and replaces the screen with the
  entry `/?intent=coach`, which resolves `coach_home` → `mobile.coach.today`
  (still the canonical "Planned" placeholder). A failed choice keeps OC11
  with "Try again"; Android Back on OC11 goes through the entry.
- **Navigation.** The steps share one screen (`setParams`). Back on OC2 and
  Android Back return to OC1; Back on OC1 leaves for O05 with the
  continuation (iOS swipe-back only there). Neither mobile registration draws
  Save & exit: Continue and Finish save.
- **Keyboard (iOS).** The pinned action rides above the keyboard; a focused
  field, and the line under it, is scrolled into view; the return key walks
  Coach name → Brand → City → Bio; dragging the page dismisses the keyboard.

## Entry and access

- `intent=coach` reaches the route from O05, `/signup?intent=coach`,
  `/login?intent=coach` or a deep link, and survives Email, Google and Apple
  sign-in (the shared continuation, SF-45). It takes priority over a
  completed Fighter profile: the entry answers `coach_onboarding`.
- An incomplete account registration goes to O04 first, keeping the intent
  (`OnboardingGate`).
- The route needs a session only (`D-ONBOARDING-ENTRY-CAPABILITY`): it is
  reachable before COACH exists.
- The Coach workspace (`mobile.coach`) renders a route only when the entry
  reports COACH (`CapabilityGate`); anyone else goes where the entry sends
  them. It checks the capability, not the last chosen context, so a person
  holding FIGHTER and COACH opens either workspace.
- `context_selection` is not mapped (`D-ENTRY-CONTEXT-SELECTION`): the root
  shows the retryable entry failure, never O05 or a home.
- Session end: the query cache is cleared when the session ends or another
  user signs in (`providers/session-cache.ts`); the onboarding route
  unmounts, so a late answer cannot navigate the next user.

## Verification

- Unit: `features/coach-onboarding/model/model.test.ts` (resume and link
  policy, vocabularies, code-point lengths, dirty-field patches, the name
  suggestion, stable error codes).
- Component: `widgets/coach-onboarding/ui/coach-onboarding-screen.test.tsx`
  against a fake SF-50 / SF-51 backend at `fetch` (new profile and
  suggestion, requirements, lengths, contract-order saves, clearing with
  `null` / `[]`, failed save, formats versus levels, completion and the
  context choice, its failure, missing requirements, account registration,
  FUTURE and stale links, completed elsewhere, load failure, Back to O05,
  resume, unsaved edits over another client's change, lost completion
  answer).
- Routes: `providers/router.test.tsx` "Coach journey (SF-53)": a completed
  Fighter choosing Coach enters OC1 with nothing written; account
  registration first with the intent kept; resume on OC2 from an old link;
  a completed Coach's old link opens Coach today; the Coach workspace needs
  COACH; FIGHTER + COACH opens it whatever the last context;
  `context_selection` stays a failure.
- iOS development build (EAS simulator build of this branch's native
  project, no native changes), iOS 18.5, against a local Phoenix on a
  throwaway database (no mocks), Metro without the developer's `.env`
  files: `/signup?intent=coach` → email code → O04 → OC1 with the account
  name suggested (nothing created before the first save) → OC1 checks →
  saved fields in the database (`{en,pl}` in contract order) → cold restart
  resumed on OC2 → another client's brand change shown after returning to
  the app, unsaved format choices kept → Finish → OC11 → `PUT
/entry/context` (204) → Coach today; cold restart and the old OC11 link
  opened Coach today. A completed Fighter signing in with `intent=coach`
  entered OC1 with the account name (not the Fighter name) suggested;
  after completion both profiles exist and the Fighter workspace still
  opens. Devices: iPhone 13 mini (375 × 812), iPhone 16 (390 × 844),
  iPhone 16 Plus (430 × 932); keyboard on City and Bio; accessibility-large
  text (wraps and scrolls; the action stays reachable).
- Not verified: Android on a device or emulator (no Android SDK here; the
  Android bundle exports), VoiceOver / TalkBack passes, Google and Apple
  sign-in on the device (the shared continuation is covered by route
  tests), the light theme on a device.
