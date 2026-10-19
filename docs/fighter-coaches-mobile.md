# Fighter mobile coaches (SF-59, SF-76)

The fighter's coaching relationships and incoming coach invitations in the
app, against Claude Design **Version 103** (`1792432236-08da`), on the SF-56
fighter endpoints (`listMyCoaches`, `getMyCoachRelationship` (SF-74),
`endMyCoachRelationship`) and the SF-73 incoming-invitation endpoints with the
SF-72 acceptance policy.

## Design reconciliation

Up to Version 98 there was no fighter-side coaches screen, and INV1
(`InviteCoach`) joined the coach's team straight after sign-in, with invented
team stats and the invite in a route. With approval, SF-59 reconciled them:

| Artboard                   | Source                                  | Route                                        | Production                | Status  |
| -------------------------- | --------------------------------------- | -------------------------------------------- | ------------------------- | ------- |
| F18 Profile · Coaches row  | `Profile.dc.html`                       | `/profile`                                   | `ProfileScreen`           | current |
| FC1 My coaches             | `FighterCoaches.dc.html` screen=list    | `/profile/coaches` (`?view=ended`)           | `MyCoachesScreen`         | current |
| FC2 Coach relationship     | `FighterCoaches.dc.html` screen=detail  | `/profile/coaches/:relationshipId`           | `CoachRelationshipScreen` | current |
| End relationship (confirm) | `FighterCoaches.dc.html` dialog=…       | modal on FC2                                 | `EndRelationshipButton`   | current |
| FCI1 Invitations (SF-76)   | `FighterCoaches.dc.html` screen=invites | `/profile/coaches/invitations`               | `InvitationsScreen`       | current |
| FCI2 Invitation (SF-76)    | `FighterCoaches.dc.html` screen=invite  | `/profile/coaches/invitations/:invitationId` | `InvitationReviewScreen`  | current |
| INV1 Coach invites fighter | `InviteCoach.dc.html`                   | `/invite/:code` (placeholder)                | —                         | FUTURE  |

FC1, FC2, FCI1 and FCI2 share one artboard (SF-76 added FCI1, FCI2 and FC2 `state=ended` with approval, Version 103): the design artifact holds its maximum of 511
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

- **Data:** one direct read, `getMyCoachRelationship(relationshipId)` (SF-74,
  `GET /api/v1/me/coaches/{id}` → `{relationship}`), on every entry and on
  return to the foreground. The SF-59 page scan is gone. An id that is not a
  UUID is never sent (the generated client puts it into the path unencoded);
  foreign, unknown and malformed ids are the backend's `404`: one
  not-available state.
- **Active:** the coach's public identity, what that coach sees
  (`disclosed_fields`) and what is never shared, and End relationship.
- **Ended** (from a stale screen or an old link; FC1 opens none): the
  not-available card with the FC1 ended row and note (`state=ended`), never
  the disclosure or an end action.
- **End relationship:** a confirmation; the request runs once (confirm is
  disabled while pending, the dialog cannot be dismissed); a failure keeps
  the dialog open and changes nothing. Only the backend's `204` is reported as
  ended; a `404` is a neutral "no longer available". Either answer drops the
  cached relationship and refetches every list. Only that relationship's id
  is sent; the fighter's other coaches are untouched.

## Invitations (FCI1, FCI2; SF-76)

- **FCI1** `/profile/coaches/invitations`, from the Invitations row on FC1:
  `listMyIncomingCoachInvitations`, newest first, cursor pages of 50, with the
  backend's status (pending, accepted, declined, cancelled, expired). Only
  pending rows open FCI2. Loading, empty, unavailable (`404`: sharing is off;
  never shown as empty), account registration first (`422`) and failure are
  separate states. Only the coach's public identity is shown; no token,
  address or digest reaches the app.
- **FCI2** `/profile/coaches/invitations/:invitationId`:
  `previewMyIncomingCoachInvitation?language=<app language>` (never cached
  once left). Coach identity, note, expiry, the fields the coach would see,
  what is never shared, and the backend's disclosure: version, the language
  of the approved text, title, summary and the full text in a sheet. The
  approved confirmation sits next to an unticked box; Accept stays disabled
  until it is ticked and sends exactly that `disclosure_version` and
  `document_language` (`acceptMyIncomingCoachInvitation`). Without an approved
  text in the app language, or with no published disclosure, the fighter can
  only decline (never another language). Decline is confirmed first and
  allowed while sharing is off.
- **Outcomes** come only from the backend: created / already connected (FC1
  refetched), declined (`204`), not available (`410`: unknown, someone else's,
  answered, cancelled or expired), sharing off (`404`, decline still offered),
  stale disclosure or language (`409`, the preview is read again and the box
  unticked), under 18 or profile first (`422`), rate limit (`429`), failure.
- **Links:** the E08 email link stays the web's (WFI1). The app answers by
  invitation id from its own inbox; no token ever enters an app route, log or
  storage. INV1 and a native token handoff stay `DEFERRED` until verified
  Universal Links / Android App Links exist
  (`D-MOBILE-FIGHTER-COACH-INVITATIONS`). Production disclosure texts are not
  approved, so in production the inbox shows "Invitations aren't available".

## Session and privacy

- Every request goes through `callWithSession`; a late answer from an ended
  session is discarded, and the query cache is cleared at every session
  boundary (SF-28), so one account's coaches never reach the next.
- Only the fighter's own `/api/v1/me/coaches` endpoints are called; no coach
  profile is fetched, and nothing about relationships is stored on the device.

## Verification

- Unit: `widgets/fighter-coaches/ui/fighter-coaches.test.tsx` (FC1 states,
  cursor paging, FC2 direct read in one request, ended history, `404`,
  malformed ids never sent, end on 204 / 404 / failure, one request at a
  time), `widgets/fighter-coach-invitations/ui/fighter-coach-invitations.test.tsx`
  (inbox statuses, empty vs sharing off vs account first vs failure, paging,
  review, explicit consent with the exact version and language, already
  connected, language and document unavailable, stale, under 18, profile,
  limit, failure, `410` / `404` endings, decline confirmation and outcomes,
  sharing-off decline, malformed ids), `providers/session-cache.test.tsx`
  (coaches, invitations and previews cleared at a session boundary),
  `shared/lib/ids.test.ts`, `providers/router.test.tsx`, registry and
  skeleton tests (tab roots titled).
- Real backend (SF-76): Phoenix and PostgreSQL on a throwaway database with
  the test-fixture legal registry: 34 API checks (two active coaches, direct
  read, IDOR, inbox isolation per verified email, OAuth-only empty inbox,
  language and version conflicts, under 18, already connected, decline) and
  8 with sharing off (inbox / preview / accept `404`, decline allowed, own
  relationships still readable, no leak).
- Native (SF-76): EAS iOS development build on iOS 18.5 simulators against
  that backend: sign-in, FC1, FC2 (direct read), FCI1, FCI2, full text,
  accept, decline, ending one of three coaches, ended history by link,
  sharing-off states, language unavailable (German), account switch, revoked
  session, network failure, cold restart; dark and light at 390 × 844;
  XCTest accessibility audit with no app findings. See the SF-76 report for
  what was not verified.
