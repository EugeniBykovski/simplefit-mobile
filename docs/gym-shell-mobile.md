# Gym mobile shell, context switching and navigation (SF-89)

The gym workspace of the one SimpleFit app: id-based gym routes, the gym
gate, G01 Gym pulse with real data, gym rows in A04 and the gym chooser.
Contracts reused unchanged: SF-83 (`getGym`, `listMyGyms`, the role
matrix), SF-84 (entry `gym_home` / `gym_selection`, `gym_workspaces`,
`PUT /api/v1/me/entry/context` with `gym_id`), SF-85 (`getGymSetup`) and
the SF-87 onboarding. No API, storage or native change.

Architecture: ADR 0026 (`simplefit-api/docs/architecture/adr/0026-gym-domain-architecture.md`),
`docs/gym-architecture.md`, `docs/route-architecture.md`
(`D-MOBILE-GYM-SHELL-MVP`).

## Routes

| Route id                                                   | Path                                     | Shell                    | Access                   | Screen          | Status                  |
| ---------------------------------------------------------- | ---------------------------------------- | ------------------------ | ------------------------ | --------------- | ----------------------- |
| `mobile.gyms._gym-id.pulse`                                | `/gyms/:gymId/pulse`                     | `mobile.gym` (tab Pulse) | GYM_WORKSPACE + gym gate | G01 (reduced)   | MVP                     |
| `mobile.gyms._gym-id.classes`, `…classes._class-id.roster` | `/gyms/:gymId/classes[/:classId/roster]` | tab Classes              | as above                 | G08, G03        | placeholder, tab Soon   |
| `mobile.gyms._gym-id.check-in`                             | `/gyms/:gymId/check-in`                  | tab QR check-in          | as above                 | G02             | placeholder, tab Soon   |
| `mobile.gyms._gym-id.members`, `…members._member-id`       | `/gyms/:gymId/members[/:memberId]`       | tab Members              | as above                 | G09, G04        | placeholder, tab Soon   |
| `mobile.gyms._gym-id.staff.on-shift`                       | `/gyms/:gymId/staff/on-shift`            | tab Staff                | as above                 | G05             | placeholder, tab Soon   |
| `mobile.gyms._gym-id.incidents.new`, `…announcements.new`  | `/gyms/:gymId/…/new`                     | pushed                   | as above                 | G06, G07        | placeholder, not linked |
| `mobile.gyms`                                              | `/gyms`                                  | `mobile.shared`          | session                  | MGC1 (new code) | MVP                     |
| `mobile.workspaces`                                        | `/workspaces`                            | `mobile.shared`          | session                  | A04 + gym rows  | MVP                     |

The member side keeps `/gym/:gymId/**` (FIGHTER) until SF-91; `/gyms` is
the staff surface only. `gym_home` maps to the Pulse of the entry's
`gym_id`; `gym_selection` to `/gyms`; `GYM_WORKSPACE.home.mobile` is
`mobile.gyms`. The registry is byte-identical with simplefit-platform.

## Screen inventory (Claude Design `1792675284-1046`, read-only)

| Screen                        | Structured source                           | Route id                               | API source                               | Access           | Class                      |
| ----------------------------- | ------------------------------------------- | -------------------------------------- | ---------------------------------------- | ---------------- | -------------------------- |
| G01 Gym pulse                 | `GymPulse.dc.html`                          | `mobile.gyms._gym-id.pulse`            | `getGym`, `getGymSetup` (owner)          | staff of the gym | MVP, reduced               |
| GymTabs                       | `GymTabs.dc.html`                           | shell `mobile.gym`                     | —                                        | —                | MVP, Pulse only linked     |
| A04 One account, every role   | `Workspaces.dc.html`                        | `mobile.workspaces` + sheet            | `resolveMyEntry`, `chooseMyEntryContext` | session          | MVP, gym rows added        |
| MGC1 Choose a gym             | A04 rows (no artboard)                      | `mobile.gyms`                          | `resolveMyEntry`, `listMyGyms`           | session          | MVP, design gap            |
| GR1 Gym pulse · opening week  | `FirstRunGPulse.dc.html`                    | pulse `?state=opening-week`            | first-run (SF-101)                       | —                | FUTURE (SF-101)            |
| GR2 Check-in tour             | `FirstRunGCheckinTip*.dc.html`              | pulse `?tip=`                          | first-run (SF-101)                       | —                | FUTURE (SF-101)            |
| G02 QR check-in               | `CheckIn.dc.html`                           | `…check-in`                            | none (SF-96/97)                          | —                | BLOCKED                    |
| G03 Class roster, G08 Classes | `ClassRoster.dc.html`, `GymClasses.dc.html` | `…classes…`                            | none (SF-93+)                            | —                | BLOCKED                    |
| G04 Member card, G09 Members  | `MemberCard.dc.html`, `GymMembers.dc.html`  | `…members…`                            | none (SF-90/91)                          | —                | BLOCKED                    |
| G05 Staff on shift            | `Staff.dc.html`                             | `…staff.on-shift`                      | shifts (none)                            | —                | FUTURE                     |
| G06 Incidents, G07 Announce   | `Incidents.dc.html`, `Announce.dc.html`     | `…incidents.new`, `…announcements.new` | none                                     | —                | FUTURE                     |
| OG6b → Gym pulse handoff      | SF-87 frame                                 | `mobile.onboarding.gym` → pulse        | entry `intent=gym`                       | owner            | MVP (unchanged flow)       |
| RouteGym, FlowGym             | `RouteGym.dc.html`, `FlowGym.dc.html`       | —                                      | —                                        | —                | reference only (web paths) |

G08 and G09 are gym tab roots in the design; their domains (classes,
members) do not exist, so their tabs are Soon. No board for a staff-specific
home, a role-restricted state, a gym-not-available state, the gym chooser
or gym rows in A04 exists: those are design gaps, built from approved
compositions (below) and listed for Claude Design.

## What G01 shows (truthful home)

Kept from G01: the identity pill (gym initials on the saved accent colour,
gym name, the viewer's role, chevron → the A04 sheet), the eyebrow (date and
location) and the title "Gym pulse"; GymTabs at the bottom.

Shown from the backend only: OG1's "How members see you" card (name, type,
primary location, "Setup complete"); for the owner the saved setup
(address, phone, website, tagline, accent colour; its own read, failure and
403 states); for every other role a limited-access notice naming their
role; "Your access" (role and the matrix description); "Coming to your gym"
(members, classes and timetable, bookings and check-ins, coaches and staff,
each "Later").

Hidden until their domains exist (SF-82 R5/C7; never zero): location chips,
the QR check-in card, check-ins, occupancy, failed payments, sales, today's
classes, the incidents and announcements actions. The header's actions slot
holds Settings (ST1: the account and Sign out).

## Behaviour

- **Gym gate** (`(gym)/_layout.tsx`): SessionGate → CapabilityGate
  (GYM_WORKSPACE from the entry; anyone else goes where the entry sends
  them) → GymGate, which reads `GET /api/v1/gyms/{gym_id}` for the gym in the
  route after the session is restored and covers the navigator until it
  answers: 404 not available (never says why), 403 role-restricted (D-G24),
  a draft "isn't set up yet" (owner: Continue setup), offline/5xx a retry,
  401 the session layer. A background re-read failure keeps what was shown.
- **Tenant isolation:** one query per gym id (`gymQueryKey(gymId)`); screens
  read the gate's gym only when it is the gym of their own route
  (`useGymWorkspace(gymId)`), so a late answer for one gym cannot appear in
  another; the session boundary clears the cache (SF-28); nothing is stored
  on the device. The gym is re-read when the app returns to the foreground,
  so a revoked membership becomes not available on the next read.
- **Switching:** A04 rows (sheet from every home, `/workspaces`): completed
  profiles, then the account's gyms (`enter` → record the gym choice, then
  replace the screen with that gym's Pulse; the owner's draft → the entry
  with `intent=gym`), then journeys; "All gyms (n)" when the entry lists
  fewer than `gym_workspace_count`. A failed choice keeps the user where
  they are and refreshes the entry.
- **Chooser** `/gyms`: the entry's gyms, then `listMyGyms` pages (completed
  gyms only), the owner's draft, the completed profiles; one gym opens at
  once; none offers gym registration.
- **Deep links** `simplefit:///gyms/<id>/pulse` pass the SF-80 native intent
  unchanged (no token, no fragment); signed out → sign-in with `returnTo`.
- **Cold start:** the entry lands on the remembered gym only while it is
  still valid (backend rule); otherwise on the account's other context.

## Claude Design handoff (not applied; needs approval)

| #   | Board                | Correction                                                                                                                                                                                                                |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | GymPulse (G01)       | Remove the KPI tiles, failed payments, sales, today's classes, location chips and QR card until SF-90+/SF-93+/SF-96+; add the "How members see you" card, the owner's gym details, "Your access" and "Coming to your gym" |
| M2  | GymPulse (G01)       | Replace the Incidents/Announcements header actions by Settings (or design an account entry for the gym shell)                                                                                                             |
| M3  | GymTabs              | A Soon state for Classes, QR check-in, Members and Staff (production: disabled, labelled "not available yet")                                                                                                             |
| M4  | Workspaces (A04)     | Gym rows ("Your gyms": gym tile, name, role · Gym pulse, current check), the owner's draft row, "All gyms (n)", a gyms-only variant                                                                                       |
| M5  | new: MGC1            | Gym chooser board (several, completed + draft, draft only, none, pending, failed)                                                                                                                                         |
| M6  | new                  | Staff limited-access home (manager, coach, front desk) and the role-restricted state                                                                                                                                      |
| M7  | new                  | Gym not available (unknown, foreign, revoked) and draft states for the gym shell                                                                                                                                          |
| M8  | FirstRunGPulse (GR1) | Checklist from real state only when SF-101 lands (no "live in Discover", payouts or invite funnel)                                                                                                                        |
| M9  | RouteGym, FlowGym    | Paths `/gyms/:gymId/…` (staff) and `/me/gyms/:gymId/…` (member)                                                                                                                                                           |

## Verification

- Jest (`pnpm test`): router tree tests (`src/providers/router.test.tsx`,
  "Gym shell, context switching and navigation (SF-89)"), entry and gym
  model tests, the G01 widget in every locale, the registry and skeleton
  tests.
- Real Phoenix/PostgreSQL (opt-in, `src/providers/gym-shell.real-api.test.tsx`):

  ```bash
  E2E_REAL_API_URL=http://127.0.0.1:<port> \
  E2E_API_DATABASE_URL=postgres://…/<…e2e…> E2E_API_DIR=../simplefit-api \
  npx jest src/providers/gym-shell.real-api.test.tsx --forceExit
  ```

  Never against port 4000 or `simple_fit_dev` (the suite refuses both).

- Native iOS: the SF-87 development build (no native change), iPhone 13
  mini (375), iPhone 14 (390) and iPhone 16 Plus (430) simulators, dark and
  light, AX5 text.
