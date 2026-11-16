# SF-160 · Five-tab shell, route registry and workspace switching

Epic SF-158 (Fighter Mobile). Builds on the SF-159 inventory in this folder
([README](README.md)): the [navigation map](c-navigation-flows.md), the
[security matrix](e-security-privacy.md) and the
[decision register](h-decisions-blockers.md). This page records what SF-160
verified and changed, and what it left open.

## Outcome

- The Fighter shell (`mobile.fighter`) already had the five tabs of the design,
  and they stay as they are: Home, Training, Live Board (the raised centre),
  Community and Profile. Tests now pin down their count, order, centre position,
  deep links, selection, nesting and labels in every locale.
- **Workspace isolation (P0, D-SF159-12).** Opening another workspace of the
  same account (Fighter, Coach or a gym) now crosses a session workspace
  boundary:
  - the previous workspace's query cache is cancelled and cleared;
  - calls still running are discarded (`SessionChangedError`);
  - only the entry just resolved for the new workspace is kept.

  Credentials and a refresh in flight are untouched. See
  `crossWorkspaceBoundary` in `src/entities/session/model/session.ts`, used by
  `useContextSwitch` in `src/features/session-gate/ui/context-switch.ts`.

- **Suspended accounts (D-SF159-11, D-SF159-22).** The backend never gives a
  suspended account a session: suspension revokes every session, refresh is
  rejected, and every sign-in answers `403 account_suspended`. Mobile therefore
  never reaches an authenticated ST14. Instead:
  - a revoked session ends as "Your session ended";
  - a later email-code, Google or Apple sign-in now says the account is
    suspended, with no retry, resend or appeal action.

  ST14's "Timer, logging, bookings available" and ST15's appeal stay
  unbuilt: the backend refuses them and no appeal API exists (D-SA29).

- **Profile (F18)** shows the fighter's own FighterProfile: name, @username,
  and stance and weight class (owner only). It also shows the F18 rows whose
  destination exists: Coaches (FC1), Gyms (My gyms, MMG1), Switch workspace
  (the A04 sheet) and Settings (ST1). It no longer shows a "Planned" badge.
- **Board and Community** keep the canonical SF-33 placeholder: no data, no
  controls and no backend call (tested against the real API). Their domains are
  SF-178/SF-179 and SF-173–SF-177.
- **Route registry parity (D-SF159-25).** The mobile copy took the platform
  copy's six web routes and two discrepancies (SF-131, SF-157). Both copies
  carry the same `mobile.profile` note and are byte-identical again (sha256
  `38ade19d…9c10`). `route-architecture.md` now differs only by mobile's SF-80
  native-intent paragraph.

## Design source

| Item                 | Value                                                                                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Artifact             | `JEsBg51MjX8KiHWEro8omY`                                                                                                                                                                                                                                                                                      |
| Version read         | `1794841517-868f` (2026-11-16), read with the Artifact tool                                                                                                                                                                                                                                                   |
| SF-159 snapshot      | `1794821244-6c73`                                                                                                                                                                                                                                                                                             |
| Shell files compared | `FighterTabs.dc.html` (`73bec094a169`), `Profile.dc.html` F18 (`e589fc7483fa`), `LiveBoard.dc.html` B21 (`d88f74e9b4e7`), `Community.dc.html` S01 (`02f9d40a8209`), `Suspended.dc.html` ST14 (`b8df24a54aff`), `FlowFighter.dc.html` (`143762e9…`), `ContextSwitcher.dc.html`, `canvas.json` (`7e3104752336`) |
| Change since SF-159  | None in these files (byte-identical); no versions mixed                                                                                                                                                                                                                                                       |

## Route reconciliation

Backend support: **real** = served by the API today; **none** = no domain.

| Destination                                                | Route id                                                                                                                    | Current screen                        | Backend                                                           | Design                                                 | SF-160 change                                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Home (tab)                                                 | `mobile.home`                                                                                                               | FR4 home (SF-41, SF-69)               | `getMyFighterProfile`, first-run, `listMyTrainingSessions` (real) | F01 (FUTURE); FighterTabs links Home to `Main.dc.html` | None: the tab stays on FR4 (D-SF160-01)                                                       |
| Training (tab)                                             | `mobile.training`                                                                                                           | FT1 list (SF-66)                      | real                                                              | F24 (FUTURE hub), FT1                                  | None                                                                                          |
| Session                                                    | `mobile.sessions._session-id`                                                                                               | FT2 (SF-66)                           | real                                                              | FT2 (F04 FUTURE)                                       | None; a deep link to another fighter's or an unknown session shows "not available" (real API) |
| Live Board (centre tab)                                    | `mobile.board`                                                                                                              | SF-33 placeholder                     | none (`api.get.board` DEFERRED)                                   | B21–B24                                                | None; no fabricated places, people or activity                                                |
| Board nodes                                                | `mobile.board.node.*`                                                                                                       | placeholders                          | none                                                              | B25–B27                                                | None                                                                                          |
| Community (tab)                                            | `mobile.community`                                                                                                          | SF-33 placeholder                     | none (`api.get.feed` DEFERRED)                                    | S01, AV2, AV2b                                         | None; no feed, friends or counts                                                              |
| Community children                                         | `mobile.discover`, `.friends`, `.following`, `.challenges`, `.marketplace`                                                  | placeholders inside the tab           | none                                                              | S02–S06, S13, MK1                                      | None                                                                                          |
| Profile (tab)                                              | `mobile.profile`                                                                                                            | was a Planned stub with two links     | `getMyFighterProfile` (real)                                      | F18                                                    | Rebuilt from real data and existing destinations                                              |
| Coaches                                                    | `mobile.profile.coaches` (+ relationship, invitations, verify-email)                                                        | FC1, FC2, FCI1–FCI3                   | real                                                              | FighterCoaches                                         | None; reached from Profile, nested in the tab                                                 |
| My gyms                                                    | `mobile.me.gyms`                                                                                                            | MMG1 (SF-100, SF-135)                 | real                                                              | F16 rows (no pass)                                     | Now linked from Profile ("Gyms")                                                              |
| Workspaces                                                 | `mobile.workspaces` + A04 sheet                                                                                             | A04                                   | `resolveMyEntry`, `chooseMyEntryContext` (real)                   | A04, ContextSwitcher                                   | Cache boundary on open; also reachable from Profile                                           |
| Settings                                                   | `mobile.settings`                                                                                                           | ST1 (Sign out)                        | `logout` (real)                                                   | ST1                                                    | None (SF-161/SF-180)                                                                          |
| Suspended                                                  | `mobile.account.suspended`                                                                                                  | SF-33 placeholder, never navigated to | only `account_suspended` errors                                   | ST14                                                   | Unchanged; sign-in screens show the suspension (D-SF160-03)                                   |
| Progress, camp, timer, calendar, pro, payments, membership | `mobile.progress`, `mobile.camp*`, `mobile.timer*`, `mobile.calendar`, `mobile.pro`, `mobile.payments`, `mobile.membership` | placeholders                          | none                                                              | F07–F12, F16, F17, F19, T01–T06                        | None; no longer linked from Profile                                                           |

Registry counts after SF-160 (both copies): 323 routes, 467 screens, 69
discrepancies. Mobile routes: 155, of which 112 are placeholder routes and
one (`mobile.sparring.find`) is deferred (no route file). The "42
placeholders" in the SF-160 brief does not match the code. 112 is the count of
`placeholderRoute` files, the same as SF-159 found.

## Design discrepancy register

| Id         | Artboard         | Expected (design)                                                                                                                 | Implementation                                                                    | Reason                                                                                                                         | Impact                                      | Status                                         |
| ---------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ---------------------------------------------- |
| D-SF160-01 | FighterTabs, F01 | Home links to `Main.dc.html`; F01 shows camp, weight and coach notes                                                              | Home is FR4                                                                       | F01 is FUTURE: no camp, weight-history or notes domain (D-SF159-09)                                                            | Truthful home; no invented statistics       | Accepted (design to relink)                    |
| D-SF160-02 | FighterTabs      | Community icon carries an unread dot                                                                                              | No dot                                                                            | No notifications or social domain                                                                                              | No fake activity signal                     | Accepted                                       |
| D-SF160-03 | ST14, ST15       | Signed-in suspended screen: timer, logging and bookings available; appeal                                                         | Sign-in screens say the account is suspended; no ST14, no appeal                  | Backend revokes every session and refuses sign-in (`sessions.ex`), no appeal API (D-SA29)                                      | Nothing promises access the backend refuses | Open (product + counsel)                       |
| D-SF160-04 | F18              | Avatar, "Fighter · gym", Go Pro, record, stance, class, friends, six rows, emergency contact, privacy, Switch workspace, Settings | Avatar, name, @username, stance, class, Coaches, Gyms, Switch workspace, Settings | Record, friends, Pro, progress, camps, sparring, payments, emergency contact and privacy have no domain; Pro is commerce NO-GO | Only real data and working destinations     | Accepted                                       |
| D-SF160-05 | F18              | "Gyms & membership pass"                                                                                                          | "Gyms" (My gyms list)                                                             | No membership pass (GC5/GC12 BLOCKED)                                                                                          | No pass implied                             | Accepted                                       |
| D-SF160-06 | B21, S01         | Journey timeline and community feed                                                                                               | Canonical "Planned" placeholder                                                   | No board or feed domain (SF-173–SF-179)                                                                                        | No fabricated people, places or posts       | Accepted until SF-178/SF-179 and SF-173–SF-177 |
| D-SF160-07 | FighterTabs      | Tab labels in English                                                                                                             | "Live Board" is untranslated in every locale (existing catalogs)                  | Product name kept as in the existing catalogs                                                                                  | None                                        | Accepted (existing decision; not changed here) |

## Workspace switching and isolation

| Event                                                | Behaviour after SF-160                                                                                                                                                                                      | Evidence                                                                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Open another workspace (A04: Fighter ↔ Coach, a gym) | The backend records the choice (`PUT /api/v1/me/entry/context`), then the entry is resolved. After that: workspace boundary, the cache cleared, late calls discarded, the new entry kept, `router.replace`. | `router.test.tsx` "workspace isolation (SF-160)" (fails without the fix); real API B (fails without the fix) |
| Continue an unfinished journey (intent)              | Same workspace; the cache is kept (Back returns to it)                                                                                                                                                      | Existing SF-55 tests                                                                                         |
| Switch fails (5xx, network)                          | User stays in place; nothing cleared; the entry is refreshed                                                                                                                                                | Existing SF-55 test                                                                                          |
| Sign-out, new sign-in, expiry                        | Session boundary (SF-28): the cache is cleared and late answers discarded                                                                                                                                   | `session-cache.test.tsx`; real API C                                                                         |
| Server-side revocation, suspension                   | The next protected call gets 401; refresh is rejected; the session ends ("expired"); protected UI and cached data go                                                                                        | Real API D/R, G                                                                                              |
| Restart                                              | No persisted query cache; the session is restored from SecureStore and the entry re-resolved; a revoked session lands on sign-in                                                                            | Real API G                                                                                                   |

Identity and permissions stay the backend's. A tab, a cached entry or a URL
grants nothing: `CapabilityGate` covers the screen until the entry reports the
capability, and every request is authorized by the API.

## Deep links

Covered by the router tests and the real API (F):

- Each tab opens selected.
- A nested Profile screen keeps the Profile tab.
- A signed-out cold launch goes to `/login?returnTo=<path>`. A deliberate
  sign-out goes to `/welcome`, with nothing to return to.
- Another fighter's session, or a malformed session id, shows "not available"
  from the API's 404.

Unsafe `returnTo` values (`//evil.example`, `simplefit://…`, `/login`) are
dropped (existing SF-24/SF-45 tests). FUTURE `/sparring/find` lands on
`+not-found`.

## Verification

Final results are in the SF-160 engineering report. In summary:

- Jest unit, component and router tests cover the five tabs, deep links,
  Profile, Board and Community, workspace isolation, the session workspace
  boundary and suspended sign-in. Every locale has the new copy.
- `src/providers/fighter-shell.real-api.test.tsx` runs the real Phoenix and
  PostgreSQL scenarios A–G. It is opt-in, uses a disposable `*e2e*` database
  and never port 4000:

  ```bash
  E2E_REAL_API_URL=http://127.0.0.1:<port> \
  E2E_API_DATABASE_URL=postgres://…/<…e2e…> E2E_API_DIR=../simplefit-api \
  npx jest src/providers/fighter-shell.real-api.test.tsx --forceExit
  ```

- Native: not run.
  - SF-160 changes no native code and no tab-bar geometry.
  - This machine has no simulator input automation and no Android SDK, so
    VoiceOver, TalkBack and interactive simulator runs are not claimed.

## Open items

- D-SF160-03: ST14/ST15 product and counsel decision (with D-SF159-11 and D-SA29).
- D-SF160-01: relink FighterTabs Home to FR4 in Claude Design (design owner; SF-160 changes no design).
- Native iOS and Android checks of the shell and Profile on a 390 × 844
  device, with VoiceOver and TalkBack.
- Platform `route-architecture.md` lacks mobile's SF-80 native-intent paragraph (documentation only).
