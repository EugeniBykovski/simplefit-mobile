# Mobile Gym owner registration (SF-87)

The production `mobile.onboarding.gym` route: the Gym owner registration of
the web (SF-86, `docs/gym-onboarding-web.md` in simplefit-platform) built
natively, on the SF-83 gym creation, SF-84 entry and SF-85 setup APIs
(ADR 0026 in simplefit-api) through the generated client.

## Design reconciliation (approved 2026-10-27)

Claude Design `1792675284-1046` has no mobile Gym owner setup artboards. Its
only mobile owner screen is **OG0 · Gym owner · continue on web**
(`OnbGHandoff.dc.html`, GYM · 4), a handoff with an emailed setup link and
code, matching SF-82's "owners create gyms on the web". SF-87 reverses that
decision: owners register on mobile too. With approval the flow is built on
the approved mobile onboarding frame (COACH · 3, 390 × 844: the 44 pt back
button, "Step n of 3 · Section", the segmented progress, the heading and
line, the scrolling body, the actions pinned above the home indicator) with
the web OG content and every SF-86 approved difference. Claude Design is
unchanged; its canvas is at the 512-file limit, so the mobile artboards are
added separately (`D-MOBILE-GYM-ONBOARDING-FLOW`).

### Audit (2026-10-27, version `1792675284-1046`)

The live canvas is still `1792675284-1046` (494 boards; the project is at the
512-file limit). Every Gym owner / staff board for a phone:

| Board                                   | File                                        | Page       | Role in SF-87                      |
| --------------------------------------- | ------------------------------------------- | ---------- | ---------------------------------- |
| 1.6 · O05 · Choose your role            | `Onboarding.dc.html`                        | onboarding | "Gym / Club" links to OG0          |
| 4.5 · OG0 · Gym owner · continue on web | `OnbGHandoff.dc.html`                       | onboarding | superseded by the mobile flow      |
| 4.1–4.4, 4.6 · OS1–OS4, OS1b · staff    | `OnbSInvite` … `OnbSTour`, `OnbSInviteCode` | onboarding | staff invitations, not owner setup |
| 1.10 · INV2 · Gym invites coach         | `InviteGymCoach.dc.html`                    | onboarding | superseded by OS1 (SF-82 C11)      |
| 34.18–34.19 · GR1, GR2 · first run      | `FirstRunGPulse`, `FirstRunGCheckinTip*`    | onboarding | after OG6b, not built (SF-101)     |
| 13.1–13.9 · G01–G09 · gym cockpit       | `GymPulse.dc.html` …                        | gym-mobile | G01 is "Go to gym"; a placeholder  |
| Flow · Gym mobile + web                 | `FlowGym.dc.html`                           | gym-mobile | starts at A04, has no setup        |

The owner setup itself exists only for the web (OG1–OG14, 1440 × 900, with
the `GymSetupSteps` rail). No board shows OG1, OG2, OG3 or OG6b on a phone.

### Discrepancies (production versus the design)

| #   | Where         | Design                                                                                                      | Production (mobile)                                                                                                                                                                | Kind                         |
| --- | ------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| D1  | O05 → Gym     | "Gym / Club" opens OG0 (handoff to the web)                                                                 | Opens OG1 on the phone (entry `intent=gym` → `gym_onboarding`)                                                                                                                     | navigation (approved)        |
| D2  | OG0           | Setup link by email, "code 4K7-Q2", "14 steps · about 20 minutes", Resend                                   | Not built; DEFERRED (SF-82 R3/C6 already removed link and code)                                                                                                                    | screen superseded            |
| D3  | OG1–OG3 frame | None for mobile; web: 300 pt step rail, "STEP 1 OF 14", footer Back / Save & exit / Continue                | COACH · 3 frame: 44 pt Back, "Step n of 3 · Section", 3-segment progress, Continue pinned above the home indicator                                                                 | missing artboards (approved) |
| D4  | Save & exit   | Web footer, text button                                                                                     | Header right, text action (Coach mobile has none)                                                                                                                                  | component placement          |
| D5  | OG1           | Public handle "✓ free"; "nothing is public until step 11"; "Saved · just now"; "Signed in with Google as …" | No handle (C2); no step-11 copy; no save stamp; "This gym belongs to the account you're signed in with"                                                                            | content (SF-82 C2)           |
| D6  | OG1 preview   | "How members see you" card with cover                                                                       | None (no room on a phone)                                                                                                                                                          | omitted aside                |
| D7  | OG1 type      | Six pill chips, "✓" when chosen                                                                             | Same six chips (`Chip`, single choice)                                                                                                                                             | match                        |
| D8  | OG2           | "Add another location", LOCATIONS list                                                                      | One location; "Adding more locations isn't available yet" (C3)                                                                                                                     | content (SF-82 C3)           |
| D9  | OG3           | Preview "✓ verified", Public URL, "Book a free trial"; logo and cover upload                                | Logo tile in the accent with initials, cover "not available yet", 6 swatches, tagline; no preview (C4)                                                                             | content (SF-82 C4) + state   |
| D10 | OG6b          | "Registration complete", trial / plan, "GET READY TO OPEN · 8 STEPS"                                        | "{name} is created.", "Get ready to open · coming later" list, one action "Go to gym" (C5 without "Continue setup": no checklist yet)                                              | content (SF-82 C5)           |
| D11 | after OG6b    | GR1 opening-week pulse (mobile)                                                                             | G01 route, "Planned" placeholder (gym shell)                                                                                                                                       | later ticket                 |
| D12 | states        | None drawn                                                                                                  | Loading, load failure, couldn't confirm + Retry, stale + "Save my changes", resumed, discarded/reused, rate limited, forbidden, gone + Start a new gym, session ended, another gym | undocumented states          |
| D13 | Register      | SF-82 register files OS1, OS1b, INV2 and OG11 under "SF-87"                                                 | SF-87 became owner registration (mobile); the staff rows need a new ticket number                                                                                                  | register bookkeeping         |

### Proposed canonical mobile owner board (not applied)

One board, no new file: repurpose **OG0 `OnbGHandoff.dc.html`** (superseded
by D1/D2) as **"4.5 · OG1–OG6b · Gym owner setup · mobile · step=type|location|branding|created ·
state=ready|unconfirmed|stale|invalid"**, 390 × 844, the COACH · 3 frame with
the web OG content and the SF-82 C2–C5 corrections, in the same variant style
as A04 `Workspaces.dc.html` (`mode=…|state=…`). Then point O05 "Gym / Club"
at it (`step=type`) and add "OG1m" to `FlowGym` before A04. This keeps the
canvas at its file count and retires the handoff. Applying it changes Claude
Design and needs explicit approval; until then
`D-MOBILE-GYM-ONBOARDING-FLOW` and this document are the reference.

## Inventory

| Artboard / screen       | Source                                   | `?step=`   | Production     | Backend                                          | Status                |
| ----------------------- | ---------------------------------------- | ---------- | -------------- | ------------------------------------------------ | --------------------- |
| OG1 · Gym name & type   | web `WebSetupGym` content, COACH 3 frame | `type`     | `TypeStep`     | SF-83 `createGym`, SF-85 `updateGymSetup`        | current (no artboard) |
| OG2 · Location          | web `WebSetupLocations` content          | `location` | `LocationStep` | SF-85 `setGymPrimaryLocation`                    | current (no artboard) |
| OG3 · Branding          | web `WebSetupBrand` content              | `branding` | `BrandingStep` | SF-85 `updateGymSetup`, `completeGymSetup`       | current (no artboard) |
| OG6b · Gym created      | web `WebGymRegDone` content              | `complete` | `CreatedStep`  | SF-85 completion, SF-84 context choice and entry | current (no artboard) |
| OG0 · continue on web   | `OnbGHandoff.dc.html` (GYM · 4)          | —          | —              | —                                                | DEFERRED (superseded) |
| OG4–OG14                | web `WebSetupSize` … `WebSetupLaunch`    | —          | —              | no sizing, billing, verification, staff domains  | FUTURE, never shown   |
| OS1–OS4 · staff (GYM 4) | `OnbSInvite` … `OnbSTour`                | —          | —              | staff invitations (later tickets)                | not part of SF-87     |

**Owner versus staff.** Owner registration creates a draft gym and its one
owner membership through `createGym`; it never accepts, needs or creates a
staff invitation. The GYM · 4 staff screens (OS1–OS4) belong to the staff
tickets and stay untouched.

## Behaviour

- **Backend only.** The draft is the viewer's owned draft from
  `GET /api/v1/me/gyms`, read fresh on every screen entry (a cold start
  reconciles with the server, never with local state); its fields,
  `revision`, `missing_requirements` and `setup_status` from
  `GET /api/v1/gyms/{gym_id}/setup`, re-read when the app returns to the
  foreground (TanStack `focusManager`). Edits are a diff over that setup, so
  a re-read updates untouched fields and keeps what is being typed. Nothing is
  stored in AsyncStorage, SecureStore or SQLite; the session boundary clears
  the query cache, and a late answer from a previous session is dropped
  (`SessionChangedError`).
- **Creation.** OG1 Continue only: `createGym` with one `client_request_id`
  per attempt (`expo-crypto` `randomUUID`). A lost answer or a timeout keeps
  the key; Retry repeats it, so the API returns the same gym. It is renewed
  only after `409 client_request_id: discarded / reused`, and then only for
  the next explicit Continue. A second tap while an action runs does nothing.
  A draft the API resumes is loaded with a notice; the typed values stay.
- **Revisions.** Every partial write sends `expected_revision`; `409 revision:
stale` writes nothing, re-reads the setup and keeps the edits; only "Save my
  changes" writes them again. The location is written whole, only when it
  changed; its name defaults to the city.
- **Completion** only through `completeGymSetup` ("Create gym" saves the
  branding first; "Skip for now" leaves unsaved branding edits out and keeps
  what was saved). OG6b shows only after the API answered `completed` in this
  session. "Go to gym" records `PUT /me/entry/context` (`context: gym`,
  `gym_id`) and asks the entry with `intent=gym`, which opens `gym_home`
  (the Gym pulse of that gym, `/gyms/:gymId/pulse`, since SF-89:
  `docs/gym-shell-mobile.md`). A gym completed
  elsewhere leaves through the entry on the next foreground re-read.
- **Save & exit** (the header's text action) saves every step's unsaved
  edits, never completes or discards, then asks the entry where to go; when
  that would reopen this draft (the person's only context), it opens Settings,
  which has Sign out.
- **Back.** The header's Back and Android's back button walk OG3 → OG2 → OG1,
  then leave the flow; edits stay in memory until saved. On OG6b Android back
  continues through the entry. iOS swipe-back is offered on OG1 only.
- **Errors.** Unknown outcome (no answer, timeout, 5xx): "couldn't confirm",
  Retry is safe. 422: field messages, focus on the first invalid field;
  completion lists the missing requirement with a way to its step. 429: the
  `retry-after` minutes when the answer carries it (native requests read it),
  otherwise "later". 403, 404 ("no longer available" with Start a new gym),
  401 / session ended, 409 conflicts: each has its own notice. No relative
  time or plural rules are used (Hermes lacks `Intl.PluralRules`).
- **Another gym.** With no draft and a completed gym, OG1 says that
  continuing creates another, separate gym.

## Approved differences

Every SF-86 difference applies (three steps, OG4–OG14 never shown, no handle
or public URL, one location, Logo and Cover "not available yet" with no image
picker, no verified, trial or plan copy, "Create gym" and "Skip for now",
OG6b "Gym created" with "Go to gym"). Mobile only:

1. No artboards: the COACH 3 frame and the web content (above).
2. No previews: a phone screen has no room for the web's asides; OG3 shows
   the logo tile in the chosen accent and the cover's unavailable panel.
3. Save & exit is the header's right action (Coach mobile has none).
4. The rate-limit time is in whole minutes (no relative-time formatting).

## Verification

- Unit: `features/gym-onboarding/model/model.test.ts` (steps, outcomes
  including the transport's network and timeout errors, form rules).
- Component: `widgets/gym-onboarding/ui/gym-onboarding-screen.test.tsx`
  against a fake SF-83/SF-85 backend (journey and payloads, requirements,
  double tap, lost create answer, discarded key, resume, stale revision,
  Skip, missing location, completed elsewhere, another gym, Save & exit).
- Routes: `providers/router.test.tsx` "Gym owner journey (SF-87)".
- Registry: `scripts/route-registry.test.js` "mobile Gym owner registration".
- Sign in with the keyboard up: `widgets/auth-screens/ui/auth-screens.test.tsx`
  "O01b sign in with the keyboard up (SF-87)" (button and Send key, with
  `intent=gym` and `returnTo` kept).

### Native cross-device journeys (2026-10-27)

iOS dev build on an iPhone 14 simulator (iOS, XCUITest), web build of
simplefit-platform, a disposable API and PostgreSQL database
(`simple_fit_sf87_e2e`); every result checked in the database.

| Journey                                                                             | Result                                                                                                                                                      |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A · web OG1 + OG2, mobile resumes at OG3 and completes, web shows the gym dashboard | pass                                                                                                                                                        |
| B · mobile OG1 + OG2, Save & exit, web resumes the same gym                         | pass: 1 gym, 1 creation request                                                                                                                             |
| C · double tap Continue and the answer lost, Retry                                  | pass: 1 POST answered then lost, the retry replays (200); 1 gym, 1 owner membership                                                                         |
| D · web saves the location while mobile edits                                       | pass: `409 revision: stale`, nothing written, edits kept; "Save my changes" writes revision 3                                                               |
| E · force-close, web edit, restart                                                  | pass: same draft, the latest revision                                                                                                                       |
| F · sign out, another account signs in                                              | pass: only that account's gym is read and shown                                                                                                             |
| G · completion, SF-84 entry                                                         | pass: `gym_home` with the gym id, owner, completed                                                                                                          |
| H · Fighter + Coach creates a gym                                                   | pass: both profiles kept; entry still reaches fighter, coach and gym homes                                                                                  |
| I · another account's gym id; revoked session                                       | pass: API answers 404 to read, write, complete, discard and context; a gym id in the link is ignored; a revoked session ends on foreground with no gym data |

### Not verified

Android native runtime; manual VoiceOver and TalkBack; light theme
screenshots; large-text passes beyond those already taken (the shared
fixed-height `Input` clips at the largest Dynamic Type sizes and is tracked
separately).
