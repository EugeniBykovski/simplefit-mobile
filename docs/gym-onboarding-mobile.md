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
  (`/gym/pulse`, the gym shell's current placeholder). A gym completed
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
