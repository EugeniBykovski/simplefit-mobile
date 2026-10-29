# Mobile gym owner first run (SF-92)

The gym owner's mobile introduction and opening checklist on Gym pulse
(GR1) and the native product tour (GR2), against Claude Design **112**
(`1793198527-a0fc`; `FirstRunGPulse`, `FirstRunGCheckinTip`,
`FirstRunGCheckinTipSteps`) and the SF-90 first-run API (simplefit-api ADR
0026, SF-90 amendment). The same backend state as the web (SF-91, GRW1 and
GRW2): one first run per gym and owner, on every client. No API, storage or
native change.

## Design inventory (version 112, read from the structured artboards)

| Screen / state                | Artboard source                        | Route                              | Backend operation                         | Owner capability   | Status                               |
| ----------------------------- | -------------------------------------- | ---------------------------------- | ----------------------------------------- | ------------------ | ------------------------------------ |
| GR1 not_started               | `FirstRunGPulse` `state=not_started`   | `mobile.gyms._gym-id.pulse`        | `getGymFirstRun`                          | `manage_first_run` | MVP                                  |
| GR1 in_progress (resume)      | `state=in_progress`                    | same                               | `getGymFirstRun`                          | same               | MVP                                  |
| GR1 pending (starting)        | `state=pending`                        | same                               | `startGymFirstRun` in flight              | same               | MVP                                  |
| GR1 failed (start)            | `state=failed`                         | same                               | `startGymFirstRun` refused / no answer    | same               | MVP                                  |
| GR1 skip_confirm              | `state=skip_confirm`                   | same (bottom sheet)                | none until confirmed                      | same               | MVP                                  |
| GR1 completed / dismissed     | `state=completed`, `dismissed`         | same                               | the kept outcome                          | same               | MVP (said once, then G01)            |
| GR1 loading / error / offline | `state=loading`, `error`, `offline`    | same                               | `getGymFirstRun` pending / failed         | same               | MVP                                  |
| GR1 session_expired           | `state=session_expired`                | session gate                       | 401 → session layer                       | —                  | MVP PARTIAL (the app's shared state) |
| GR1 revoked                   | `state=revoked`                        | gym gate                           | 404 → gym not available                   | —                  | MVP PARTIAL (the app's shared state) |
| GR2 1 checklist               | `FirstRunGCheckinTip` `step=1`         | pulse (modal overlay)              | none                                      | same               | MVP                                  |
| GR2 2 your gym                | `step=2`                               | same                               | none                                      | same               | MVP                                  |
| GR2 3 Soon tabs               | `step=3`                               | same                               | none                                      | same               | MVP                                  |
| GR2 4 switcher                | `step=4`                               | same                               | none (switches nothing)                   | same               | MVP                                  |
| GR2 finishing / finish_failed | `step=finishing`, `finish_failed`      | same                               | `completeGymFirstRun`                     | same               | MVP                                  |
| GR2 confirm (end)             | `step=confirm`                         | same                               | `dismissGymFirstRun` once confirmed       | same               | MVP                                  |
| GR2 done                      | `step=done`                            | same                               | the kept `completed`                      | same               | MVP                                  |
| GR2 f-pulse … f-announce (6)  | `step=f-*`                             | —                                  | none (members, check-in, classes, staff…) | —                  | FUTURE (not built, unreachable)      |
| G01 staff / G01 403           | `GymPulse` `state=staff`, `restricted` | pulse, gym gate                    | no first-run call / 403                   | other roles        | MVP (SF-89, unchanged)               |
| A04 gyms, MGC1                | `Workspaces` `switch_gyms`, `chooser`  | `mobile.workspaces`, `mobile.gyms` | entry, context choice                     | —                  | MVP (SF-89, unchanged)               |

**Step counts.** The Jira title says "8-step tour" (the original design).
Version 112's structured inventory has **4 active MVP steps** (+ done,
finishing, finish_failed, confirm) and **6 FUTURE steps** (`f-pulse`,
`f-checkin`, `f-classes`, `f-members`, `f-staff`, `f-announce`); the web
tour (GRW2) has 7 FUTURE steps. Only the 4 active steps are built.

## Behaviour

- **Owner only.** Gym pulse asks for the first run only when the viewer's
  permission projection holds `manage_first_run`. Managers, coaches and
  front desk never call it (the backend answers them 403 anyway); a 403
  keeps G01; a 404 re-reads the gym, so the gym gate shows "not available".
  Drafts never reach Pulse (`unavailable`; the gate continues SF-87 setup).
- **GR1.** While the first run is `not_started` or `in_progress`, the
  introduction card (Start the tour / Resume tour with the start date, Skip)
  and the checklist replace the details and coming-later cards, above "Your
  gym" and "Your access". The checklist is the API's five items, in its
  order and statuses: done and available first under "Your gym is ready"
  (only when `create_gym` is completed), the rest under "More tools are
  coming", announced as not available. No counts, percentages or links.
- **Start / Resume** calls `startGymFirstRun` and opens the tour only when
  the backend answers `in_progress`; a failure stays on GR1 with "We
  couldn't save that. Nothing changed." and Try again. A resumed tour starts
  at step 1: the backend keeps no step.
- **GR2** is one modal over the whole screen (tabs and header included):
  each step scrolls its target into view (`reveal`), measures it in window
  coordinates with the shared `Spotlight` (FR5), and re-measures on rotation,
  text-size change, page reflow and return to the foreground; a target that
  cannot be measured gets no ring or arrow and the card stays on screen.
  Back and Next record nothing. Highlighting the identity pill switches
  nothing.
- **Finish** (step 4) → `completeGymFirstRun`: "Finishing…", then the
  complete card when the backend keeps `completed`; a failure keeps step 4
  with Try again. **End tour** asks in the card; **End introduction** →
  `dismissGymFirstRun`. **Skip** on GR1 asks in a bottom sheet, then
  dismisses. Neither outcome changes the checklist.
- **Lost answers and conflicts.** No answer (offline, timeout) or a 5xx to an
  ending reads the state again: a final state is shown as kept; otherwise the
  failure stays with Try again (repeats are safe). A 409 (the other outcome
  was kept elsewhere) re-reads it, closes the tour or sheet and shows what the
  backend kept. An outcome kept on another device while the tour is open
  (noticed on returning to the foreground) closes it the same way.
- **Never reopens.** `completed` and `dismissed` are said once, on the screen
  that kept them; every later visit, cold start, sign-in and client shows
  G01.
- **Android Back** goes one step back, on step 1 opens the end confirmation,
  on the confirmation keeps going, on the complete card closes; it never
  records. The skip sheet closes with Back unless a request is in flight.
- **Isolation.** One query per gym id; Gym pulse is keyed by gym, so a
  switch never carries an open tour or sheet into another gym; the session
  boundary clears the cache (SF-28). Nothing is stored on the device.
- **Accessibility.** Each step is announced with its position, title and
  text; the card is a modal (VoiceOver and TalkBack stay inside); 44 pt
  buttons; checklist rows read title, line and status; FUTURE rows are
  disabled; reduced motion turns the fade off (shared `Spotlight`).

## Differences from Claude Design 112 (`D-MOBILE-GYM-FIRST-RUN`, resolved)

1. Rings and cards are measured from the mounted UI, not the artboard's
   coordinates of a 390 × 1060 frame; on a phone where the target leaves no
   room (the complete card on a 375 pt screen, the checklist at AX text
   sizes) the card is clamped on screen and may cover the end of the target.
2. Step 2 rings "Your gym" (the summary card), as drawn; "Your access" stays
   below it, outside the ring.
3. The coach mark uses the opposite theme's tokens (bone on dark, graphite
   on light), as FR5, instead of an always-bone card.
4. `pending` is the Start button's loading state and `failed` its inline
   alert; `session_expired` and `revoked` are the app's shared session and
   gym-not-available states; the skip confirmation is the shared bottom
   sheet.
5. The completed and dismissed notices show only on the screen that kept
   the outcome; later visits show G01. There is no tour replay (FUTURE).
6. The resume card names the start date the backend keeps ("You started it
   on Oct 28"), not the client ("on the web"), which the backend does not
   record.

## Verification

- Jest: `widgets/gym-workspace/ui/gym-first-run.test.tsx` (GR1 states, API
  order, owner-only requests, 403, failed and offline reads, start failure,
  skip sheet, 409 on start and finish, the four steps with Back and Next,
  finish failure and retry, lost answer reconciled or not, end confirmation,
  Android Back, missing target, a foreground refresh closing the tour, Gym A
  / Gym B, every locale) and `providers/router.test.tsx` (SF-92 cases on the
  real route tree: cold start with GR1, Start and Finish with empty bodies,
  completed / dismissed cold start on G01, deep link resume, staff never
  asking, a tour not carried into another gym).
- Real Phoenix / PostgreSQL (opt-in, `src/providers/gym-first-run.real-api.test.tsx`,
  scenarios A–W; never port 4000 or `simple_fit_dev`):

  ```bash
  E2E_REAL_API_URL=http://127.0.0.1:<port> \
  E2E_API_DATABASE_URL=postgres://…/<…e2e…> E2E_API_DIR=../simplefit-api \
  npx jest src/providers/gym-first-run.real-api.test.tsx --forceExit
  ```

  With `E2E_HANDOFF_FILE` it writes the account and gym ids (no tokens) for
  the SF-91 web UI leg; with `E2E_WEB_COMPLETED_GYM` it checks a gym whose
  tour was finished in the web UI (scenario L).

- Native iOS (2026-10-29): the SF-87 development build (no native change)
  on iOS 18.5 simulators, iPhone 13 mini (375), iPhone 14 (390) and iPhone
  16 Plus (430), against a disposable API, driven by XCUITest: sign-in, GR1,
  the skip sheet (kept), Start, the four steps, End tour → Keep going,
  Finish, the complete card, the finished notice; then a cold relaunch on
  G01. Dark at all three widths, light (switched in the app) at all three,
  AX5 text at 390: every run recorded `completed` in the database, and the
  XCUITest accessibility audits reported nothing beyond the dev client's own
  gear button and the zero-size text element G01 already had (SF-89).
- Not verified: Android on a device or emulator (no Android tooling; the
  Android JS bundle builds and Android Back is covered by Jest), VoiceOver
  and TalkBack by hand, rotation (the app is portrait-only).
