# Fighter mobile coaches (SF-59)

The fighter's coaching relationships in the app, against Claude Design
**Version 99** (`1792069267-b198`), on the SF-56 fighter endpoints
(`listMyCoaches`, `endMyCoachRelationship`). Coach invitations are **not** in
the app yet (see [Invitations](#invitations-deferred)).

## Design reconciliation

Up to Version 98 there was no fighter-side coaches screen, and INV1
(`InviteCoach`) joined the coach's team straight after sign-in, with invented
team stats and the invite in a route. With approval, SF-59 reconciled them:

| Artboard                   | Source                                 | Route                              | Production                | Status  |
| -------------------------- | -------------------------------------- | ---------------------------------- | ------------------------- | ------- |
| F18 Profile · Coaches row  | `Profile.dc.html`                      | `/profile`                         | `ProfileScreen`           | current |
| FC1 My coaches             | `FighterCoaches.dc.html` screen=list   | `/profile/coaches` (`?view=ended`) | `MyCoachesScreen`         | current |
| FC2 Coach relationship     | `FighterCoaches.dc.html` screen=detail | `/profile/coaches/:relationshipId` | `CoachRelationshipScreen` | current |
| End relationship (confirm) | `FighterCoaches.dc.html` dialog=…      | modal on FC2                       | `EndRelationshipButton`   | current |
| INV1 Coach invites fighter | `InviteCoach.dc.html`                  | `/invite/:code` (placeholder)      | —                         | FUTURE  |

FC1 and FC2 share one artboard: the design artifact holds its maximum of 511
files, so the frozen `TimerDone` preview was removed (T06 now points at
`TimerLive.dc.html` with `phase=done`, as the registry's query already said).

## My coaches (FC1)

- **Data:** `GET /api/v1/me/coaches?status=active|ended`, cursor pages of 50
  ("Show more" follows `next_cursor`). Active rows: the coach's display name
  (or brand), the brand and the start date; they open FC2. Ended rows: the
  coach's name at the end, the end date and who ended it; they open nothing.
- **States:** loading (skeletons), empty (the backend returned none),
  unavailable (`404`: no completed fighter profile; never shown as empty) and
  failure (retry). The list is read fresh on every entry and when the app
  returns to the foreground, so an end on the web or another device shows up.

## Coach relationship (FC2)

- Fighters have no single-relationship read, so the id is looked up in the
  fighter's own active list (at most 10 pages of 100). An ended, foreign or
  unknown id is one "not available" state. The route parameter authorizes
  nothing.
- Shows the coach's public identity, what that coach sees (`disclosed_fields`)
  and what is never shared.
- **End relationship:** a confirmation; the request runs once (confirm is
  disabled while pending, the dialog cannot be dismissed); a failure keeps
  the dialog open and changes nothing. Only the backend's `204` is reported as
  ended ("{coach} no longer sees your profile."). A `404` proves nothing about
  this request: a neutral "no longer available" without the coach's name.
  Either answer drops the cached relationship and refetches every list.
  Only that relationship's id is sent; the fighter's other coaches are
  untouched.

## Session and privacy

- Every request goes through `callWithSession`; a late answer from an ended
  session is discarded, and the query cache is cleared at every session
  boundary (SF-28), so one account's coaches never reach the next.
- Only the fighter's own `/api/v1/me/coaches` endpoints are called; no coach
  profile is fetched, and nothing about relationships is stored on the device.

## Invitations (deferred)

`D-MOBILE-FIGHTER-COACH-INVITATIONS`. Three dependencies are missing:

1. **Responding by invitation id is not decided.** SF-73 added the read-only
   inbox `listMyIncomingCoachInvitations` (`GET /api/v1/me/coach-invitations`:
   invitations addressed to the viewer's verified email identities, coach
   public identity, note, effective status and dates, an opaque invitation
   id, never the token; `404` while sharing is off). Accept / decline still
   need the one-time token from the E08 link; responding by id awaits
   approval (ADR 0021, SF-73 amendment).
2. **No secure native handoff.** The E08 link is the web's
   (`{WEB_APP_URL}/invite/coach#token=…`; its web review page does not exist
   yet either, `GAP-WEB-COACH-FIGHTER-INVITE`). The app has only the
   `simplefit` scheme; a custom-scheme or route parameter would expose the
   token. A native flow needs: a verified HTTPS domain with
   `apple-app-site-association` and `assetlinks.json`, iOS Associated Domains
   and Android App Links (`autoVerify`) for `/invite/coach`, the fragment
   read in memory only (never Expo Router params, logs, analytics or
   storage), bound to the signed-in account at review time and dropped on a
   session change, the browser as fallback when the app is not installed,
   and verification on a real development build.
3. **Legal texts.** Sharing is off until the approved disclosure and coach
   data-rules texts and versions exist; the app must not invent them.

Accepting is never automatic: neither sign-in nor onboarding completion
accepts anything, and accounts without a verified email identity for the
invited address (Google / Apple only) cannot accept until verified-email
linking exists.

## Verification

- Unit: `widgets/fighter-coaches/ui/fighter-coaches.test.tsx` (list, empty vs
  unavailable vs failure, ended rows, cursor paging, detail lookup across
  pages, not available, end on 204, 404 neutral, failure, single request,
  two coaches independent), `providers/session-cache.test.tsx` (coaches
  cleared at a session boundary), `providers/router.test.tsx` (canonical
  routes), the registry and skeleton tests.
- Real backend: a contract smoke against Phoenix and PostgreSQL on a
  throwaway database with sharing off (the production default): both lists,
  public identity only, no fighter private data, cursor paging, foreign and
  unknown ids `404` and untouched, end `204`, idempotent repeat, the other
  coach untouched, unauthenticated `401`, and invitation preview `404`.
- Native: not verified on a simulator in SF-59 (see the ticket report).
