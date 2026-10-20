# Coach mobile sessions (SF-65)

The Coach app's Sessions tab, against Claude Design **Version 105**
(`1792504884-2e4e`), on SF-62 (`createMyCoachTrainingSession`,
`getMyCoachTrainingSession`, `updateMyCoachTrainingSession`,
`cancelMyCoachTrainingSession`) and SF-63 (`listMyCoachTrainingSessions` with
`view=upcoming|history`). The same records and rules as the web planner
(SF-64, `simplefit-platform/docs/coach-sessions-web.md`).

## Design reconciliation

Before SF-65 the Coach Mobile page had no screen for a coach's sessions:
CoachTabs marked Sessions Soon, and C02 Roster & attendance and C05 Session
control draw a live group class (attendance, group timer, broadcast) the API
does not have. With approval, SF-65 added CT1–CT4. The artifact is at its file
limit, so they are screens of `SessionControl.dc.html`; C05 stays there as
`screen=control`, FUTURE (`D-MOBILE-COACH-SESSIONS-PLANNER`).

| Artboard         | Source                                               | Route                                | Production                 | Status  |
| ---------------- | ---------------------------------------------------- | ------------------------------------ | -------------------------- | ------- |
| CT1 Sessions     | `SessionControl.dc.html` `planner`                   | `/coach/sessions` (`?view=&status=`) | `CoachSessionsScreen`      | current |
| CT2 New session  | `SessionControl.dc.html` `create`                    | `/coach/sessions/new`                | `CoachSessionCreateScreen` | current |
| CT3 Session      | `SessionControl.dc.html` `detail`                    | `/coach/sessions/:sessionId`         | `CoachSessionScreen`       | current |
| CT4 Edit session | `SessionControl.dc.html` `edit`                      | `/coach/sessions/:sessionId/edit`    | `CoachSessionEditScreen`   | current |
| CoachTabs        | `CoachTabs.dc.html` (`active=sessions`)              | Coach tab bar                        | `tabNavigation.coach`      | current |
| C01 Coach today  | `CoachToday.dc.html`                                 | `/coach/today`                       | `CoachTodayScreen`         | current |
| C05 / C02        | `SessionControl.dc.html` `control`, `Roster.dc.html` | placeholders                         | —                          | FUTURE  |

No calendar grid: an agenda list, as on the web.

## Sessions (CT1)

- The backend's projections: Upcoming, and History narrowed to Completed or
  Cancelled; order, buckets and statuses are the server's. A past-due
  planned session stays Planned. Cursor pages of 50, "Show more", pull to
  refresh, refetched when the app returns to the foreground.
- Rows are grouped by the day of each session in its own zone and show the
  start on that zone's clock, the zone's city, title, type, fighter (display
  name, else `@username`, else "Fighter not shared"), duration and status.
- Loading, empty (per view and filter), not available (`404`: no coach
  profile or sharing off; New session disabled) and failure (retry) are
  separate states.

## New session and edit (CT2, CT4)

- **Fighter:** the coach's active relationships (`listMyCoachFighters`, every
  page) in a searchable sheet; one is preselected; none is its own state with
  "Go to Fighters"; a `404` is never an empty roster. A fighter whose
  relationship ended while the form was open is dropped. On edit it is fixed.
- **Start:** the native date and time pickers (`@react-native-community/
datetimepicker`) run in UTC so they return the wall date and time the coach
  means, independent of the device's zone; a searchable IANA zone (the
  device's by default). `shared/lib/time-zone` resolves the wall time with
  the device's zone data: one instant, none (DST gap: a notice, the button is
  disabled, nothing is sent) or two (DST overlap: First / Second with their
  offsets must be chosen). The request carries RFC 3339 with that zone's
  offset at that instant (never today's or the device's offset).
- **Idempotency** (ADR 0023): one `client_request_id` per request body, reused
  when the same body is sent again. After an unknown outcome (no answer, a
  5xx) the key stays even if the coach edits the form, because the session
  may exist: the retry then creates it or returns the session stored earlier
  (`200`, unchanged). When that session differs from the form, the form says
  so ("An earlier attempt was already saved", with Open) instead of creating
  a second session or reporting the edited values as saved. A
  `409 client_request_id: reused` (the earlier attempt was for another
  fighter) is reported and starts a new key. No deduplication by title, date
  or fighter.
- **Edit** sends only the changed fields; a moved start goes with its
  offset, a changed zone with its start; nothing changed sends nothing.
- **Refusals:** field codes land on their fields in the app's language
  (`starts_at: out_of_range` → between yesterday and one year from now);
  `409` and `404` are notices; a terminal session gets no form.

## Session and cancel (CT3)

- `getMyCoachTrainingSession`: status, fighter, type, start in its zone with
  the offset, "Your time" in the device's zone (or "same time zone"),
  duration, notes, completion time, or cancellation (by you / the
  relationship ended).
- Edit and Cancel session only while planned. Cancel needs the confirmation
  sheet; one request; only the backend's `200` is shown as cancelled; `409`
  (completed meanwhile) and `404` get their own messages. Unknown, foreign,
  ended and malformed ids are one not-available state (a non-UUID id is never
  sent).

## Navigation, cache and security

- Sessions is a tab of the Coach shell (`(coach)/(tabs)/(sessions)`); CT2–CT4
  are pushed above the tabs. Every route sits behind the session and COACH
  capability gates of `(coach)/_layout.tsx`.
- Nothing is persisted on the device; the query cache is cleared at every
  session boundary and late responses of a previous session are discarded
  (SF-28, `callWithSession`). Notes and fighter names are never logged.

## Verification

- **Unit / component (Jest):** `shared/lib/time-zone` (offsets on the
  planned day, Warsaw gap and overlap, edges, another zone, UTC-midnight
  crossing, a changed zone, reading a stored instant back, the UTC picker),
  `features/training-session-form` (body and offset, every missing field,
  several fighters, gap never sent, overlap choice, key reuse after a lost
  answer, the earlier attempt shown after a lost answer and an edit,
  `409 reused`, field codes, no fighters / unavailable / failure, edit diff,
  `409`), `widgets/coach-sessions` (projections and zones, filter and cursor,
  states, read-only terminal sessions, cancel only after confirmation, `409`
  on cancel, malformed ids, the copy has no ICU plural), router and registry
  tests.
- **Native (iOS simulator, development build, real API):** iPhone 14
  (390 × 844), iPhone 13 mini (375 × 812, accessibility-large text), iPhone 16
  Plus (430 × 932, light theme). XCUITest accessibility audits on CT1–CT4.
- **Real Phoenix / PostgreSQL** (local, disposable `simple_fit_sf65_e2e`
  only): create, edit, cancel, fighter completion, two fighters, relationship
  end, sharing off, sign-out and another coach on the same device, the web
  planner on the same records, refetch on cold start and on return to the
  foreground, and the backend's own DST and idempotency answers.

### Hermes notes

- Hermes on iOS has no `Intl.PluralRules`: an ICU `plural` message throws at
  render. The Sessions copy uses none (a test guards it).
- XCUITest types far faster than a person; with autocorrect on, the title
  field then drops or reorders characters. Typed at 0.2 s per character it is
  exact.
