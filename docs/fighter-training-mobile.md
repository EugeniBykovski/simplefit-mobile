# Fighter mobile training (SF-66)

The Fighter app's Training tab, against Claude Design **Version 106**
(`1792569354-73b2`), on SF-62 / SF-63 (`listMyTrainingSessions`,
`getMyTrainingSession`, `completeMyTrainingSession`). The same records the
coach plans on the web (SF-64) and on mobile (SF-65).

## Design reconciliation

The Fighter training artboards drew data the API does not have: weekly done
counts, a boxing timer, shared sessions, a training log with RPE and distance,
a block plan with rounds and equipment, a live session and a results screen.
With approval, SF-66 reconciled them in place (the artifact is at its file
limit; nothing was deleted) (`D-MOBILE-FIGHTER-TRAINING`):

| Artboard         | Source                                   | Route                          | Production              | Status  |
| ---------------- | ---------------------------------------- | ------------------------------ | ----------------------- | ------- |
| FT1 Training     | `TrainingHub.dc.html` `list`             | `/training` (`?view=&status=`) | `FighterTrainingScreen` | current |
| FT2 Session      | `SessionDetail.dc.html` `detail`         | `/sessions/:sessionId`         | `FighterSessionScreen`  | current |
| F24 Training hub | `TrainingHub.dc.html` `hub`              | —                              | —                       | FUTURE  |
| F04 Session plan | `SessionDetail.dc.html` `plan`           | —                              | —                       | FUTURE  |
| F05, F06, F12    | `LiveTraining`, `SessionLog`, `Calendar` | placeholders                   | —                       | FUTURE  |

## Training (FT1)

- The backend's projections: Upcoming, and History narrowed to Completed or
  Cancelled; order, buckets and statuses are the server's. A past-due planned
  session stays Planned; nothing is inferred from the planned end.
- Rows are grouped by the day of each session in its own zone: the start on
  that zone's clock, the zone's city, title, type, coach (display name and
  brand while active; "Former coach · name" after the end; "Coach not shared"
  otherwise), duration and status. Sessions from every coach are listed.
- Cursor pages of 50, "Show more", pull to refresh, refetched on focus and on
  reconnect. Loading, empty (per view and filter), not available (`404`: no
  completed fighter profile) and failure (retry) are separate states. Rows
  stack at accessibility text sizes.

## Session and completion (FT2)

- `getMyTrainingSession`: coach, type, start in its zone with the offset,
  "Your time" in the device's zone (or "same time zone"), duration, the
  coach's notes, status and, once ended, the completion time or the
  cancellation (by the coach, or the relationship ended).
- **Mark as completed** only while planned, behind a confirmation sheet; one
  request with no body (the server sets `completed_at`); never on a timer.
  - `200`: the returned session is shown (completed, its time). A repeat
    returns the same session with the original time.
  - `409 starts_at: not_started`: "hasn't started yet", the session stays
    planned. The device clock is never the authority.
  - `409 status: cancelled`: "was cancelled", the session is read again.
  - `404`: not available.
  - No answer or a server error: "it may already be saved", nothing is shown
    as completed, the sheet stays open, and the session and lists are marked
    stale (read again on the next focus, visit or retry, not at once: while
    offline that read would fail too). Trying again is safe: the repeat
    returns the completion stored the first time.
- A session already shown stays on screen when reading it again fails
  (offline); only the backend saying it is gone (`404`) replaces it.
- After the relationship ended, a session that had already started stays
  completable (ADR 0023); completed and cancelled sessions are read-only.

## Access, cache and security

- Since SF-66 the Fighter shell has the CapabilityGate (FIGHTER from the
  entry), like the Coach shell. The navigator stays mounted under the gate,
  so a screen may ask for its data once before a redirect; the backend
  answers `404` without a fighter profile.
- Nothing is persisted on the device; the query cache is cleared at every
  session boundary and late responses of a previous session are discarded
  (SF-28). The copy uses no ICU plural (Hermes on iOS has no
  `Intl.PluralRules`; a test guards it).

## Verification

- Jest: the list (projections, coach and former coach, zones, filter, cursor,
  states), the session (identity, zones, notes), completion (confirmation,
  one request without a body, repeat with the original time, not started,
  cancelled meanwhile, no answer then a safe retry, a failed re-read keeps the
  session, `404` replaces it), relationship end, malformed ids, the copy guard,
  the FIGHTER gate (a Coach-only user is sent to their home) and the router.
- iOS simulators on the real API (`simple_fit_sf66_e2e`): iPhone 14 (390 × 844),
  iPhone 13 mini (375 × 812, accessibility-large), iPhone 16 Plus (430 × 932,
  light); XCUITest accessibility audits on FT1 and FT2.
