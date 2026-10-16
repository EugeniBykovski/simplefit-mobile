# Coach mobile fighters and invitations (SF-61)

The Coach app's Fighters tab, against Claude Design **Version 102**
(`1792155768-3179`), on SF-56 (`listMyCoachFighters`, `getMyCoachFighter`,
`endMyCoachFighterRelationship`) and SF-57 (`listMyCoachInvitations`,
`createMyCoachInvitation`, `resendMyCoachInvitation`, `cancelMyCoachInvitation`,
`getMyCoachDataRules`, `acknowledgeMyCoachDataRules`). The same records and
rules as the web roster (SF-58).

## Design reconciliation

C03 and C04 used to show a fighter search over invented counts, camp and
alert filters, adherence, weight, next fight, RPE, injury and coach notes,
and Note / Clip / Assign actions; CoachTabs marked Fighters Soon; C01 said
fighters and invitations were not available. With approval, SF-61 updated
them in place (no new files):

| Artboard         | Source                     | Route                           | Production            | Status                |
| ---------------- | -------------------------- | ------------------------------- | --------------------- | --------------------- |
| C03 Fighters     | `Fighters.dc.html`         | `/coach/fighters` (`?view=ended | invitations`)         | `CoachFightersScreen` | current |
| C03 invite sheet | `Fighters.dc.html` sheet=… | sheet on C03                    | `InviteFighterSheet`  | current               |
| C04 Fighter      | `FighterQuick.dc.html`     | `/coach/fighters/:fighterId`    | `CoachFighterScreen`  | current               |
| CoachTabs        | `CoachTabs.dc.html`        | Coach tab bar                   | `tabNavigation.coach` | current               |
| C01 Coach today  | `CoachToday.dc.html`       | `/coach/today`                  | `CoachTodayScreen`    | current               |

Sessions stays Soon (no session domain, SF-62 / SF-65).

## Fighters (C03)

- **Views:** Active and Ended relationships (`listMyCoachFighters`, cursor
  pages of 50, pull to refresh, "Show more") and Invitations
  (`listMyCoachInvitations`). An invitation is never a fighter.
- **Active rows:** the fighter's name and the C1+C2 fields they disclosed
  (username, place, level); they open C04 by relationship id. **Ended rows:**
  only the name at the end, the end date and who ended it; they open nothing.
- **States:** loading, empty (the backend returned none), unavailable (`404`:
  sharing off or no completed coach profile; the + button is disabled) and
  failure (retry) are separate; a failed "Show more" says so.
- **Invitations:** the masked address, the backend status, dates; pending ones
  can be resent (while resends remain; the backend's cooldown is reported) or
  cancelled after confirmation.

## Inviting (C03 sheet)

- The coach data rules come first when the backend asks for them: the exact
  version it serves, with an unticked acknowledgement
  (`acknowledgeMyCoachDataRules`); a `409 stale` asks again. No legal text is
  invented: a document link comes with SF-71 / SF-72. With no version
  configured, or sharing off, inviting is truthfully blocked.
- Then the email (email keyboard, no autocorrect) and an optional note
  (≤ 500 characters, one paragraph). Validation is for usability only; the
  backend's field codes are mapped (`invalid` is the coach's own address).
  One request at a time.
- Success says only that an invitation to the address is pending until its
  expiry: the backend answers a reused pending invitation like a new one, so
  no "created" or "already invited" is claimed and no email is promised. Rate
  limits and the pending-invitation cap are shown; `data_rules_acknowledgement:
required` returns to the data rules.

## Fighter (C04)

- `getMyCoachFighter`: the C1+C2 fields the fighter disclosed, "Not shared" for
  the rest, what is never shared, and a note that sessions and notes come
  later (no Note / Clip / Assign). Ended, foreign or unknown ids and sharing
  off are one not-available state.
- **End relationship:** a confirmation sheet; one request; only the backend's
  `204` is reported as ended; a `404` gets a neutral message without the name.
  Either answer drops the cached fighter detail and refetches the roster; only
  that relationship id is sent.

## Coach today (C01)

The Fighters and Invites tiles and "Invite your first fighter" open the
Fighters tab (no counts are shown: there is no count API); Sessions stays a
dash.

## Session and privacy

Every request goes through `callWithSession`; the query cache is cleared at
every session boundary (SF-28); only `/api/v1/me/coach/*` endpoints are called;
no token, link or recipient digest ever reaches the app.

## Known limitation

With sharing off, the backend still lets a coach end a relationship (`204`),
but the roster and the detail are `404`, so the app offers no way to reach it.

## Verification

- Jest: `widgets/coach-fighters/ui/coach-fighters.test.tsx` (17: roster states,
  paging, privacy canaries, invitations, cancel, resend cooldown, data rules,
  stale version, blocked, validation, single submit, neutral pending, rules
  required, detail, 404, end 204 / 404 / failure), `shared/ui` Sheet,
  `providers/router.test.tsx` (live Fighters tab, C01 links), registry tests.
- Real backend (Phoenix + PostgreSQL, throwaway database, test-only sharing
  configuration), twice on fresh databases, 25 / 25: empty roster, data rules
  (version, `409` before acknowledging, stale, acknowledge), invite `201`, the
  same address `200` with the same id, masked address and no token, resend
  cooldown, invitations not in the roster, two fighters accept with the
  emailed token (the SF-57 call the SF-60 page makes), roster with C1+C2 only
  and no private data, detail keys, another coach `404`, end `204`, detail
  `404` afterwards, the other fighter still active, the ended stub, accepted
  invitations not cancellable, cancel a pending one, `401` without a session.
  Sharing off: roster, invitations, data rules, invite and detail all `404`.
- Native: not verified (see the ticket report).
