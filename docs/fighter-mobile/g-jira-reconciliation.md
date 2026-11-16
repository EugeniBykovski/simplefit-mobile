# G. Jira reconciliation (SF-159)

## Status: BLOCKED

Jira was **not accessible** in this session: there was no Jira CLI and no Jira
connector. The SF-158 child issues (SF-160 to SF-186) could not be read, so
their titles, descriptions and acceptance criteria are unknown here.

Reconciliation against the actual Jira text is therefore **BLOCKED**
(D-SF159-46). This artifact does not describe, guess or quote the contents of
any SF-160–SF-186 issue. Instead it provides:

1. a proposed SF-158 work breakdown derived from verified evidence;
2. a checklist to apply to each existing child issue;
3. amendment text blocks to paste into the matching issue once it is
   identified;
4. the work that is already done and must not be re-ticketed.

## 1. Proposed SF-158 work breakdown

Groups follow [Artifact I](i-roadmap.md). Ids `P1`… are proposal ids, not Jira
keys.

| Id  | Group         | Scope                                                                         | Artboards                                               | Backend dependency                                 | Mobile work                                                                                                                     | Gating decision                        | Acceptance                                                                                            |
| --- | ------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| P1  | 1 Core        | Restricted-account handling and error-code coverage                           | ST14                                                    | Exists (`account_suspended`)                       | Map the error to `mobile.account.suspended`; handle `enrollment_required`, `invitation_recipient_mismatch`, `revision_conflict` | D-SF159-11 (copy)                      | A suspended account lands on the ST14 screen, not a generic error; tests at `fetch` level.            |
| P2  | 1 Core        | Profile tab with real identity                                                | F18                                                     | `getMyFighterProfile`                              | Replace links-only `ProfileScreen`                                                                                              | D-SF159-09 for Home only               | Shows display name, username, city, stance from the API; blocked rows not shown as live; tests added. |
| P3  | 1 Core        | Settings hub and account details                                              | ST1, ST2, ST13                                          | Account profile, email identities, legal documents | Hub rows to built children; ST2 read/edit name; help links                                                                      | None                                   | Every row opens a built screen or is absent; DOB read-only.                                           |
| P4  | 1 Core        | Sign-in and security                                                          | ST3                                                     | SF-157 password ops                                | Password status, change, reset                                                                                                  | D-SF159-10                             | Matches the decided design; `password_not_set` handled.                                               |
| P5  | 1 Core        | Edit fighter profile                                                          | ST4                                                     | `updateMyFighterProfile`                           | Edit existing fields only                                                                                                       | None                                   | No photo, bio or home gym.                                                                            |
| P6  | 1 Core        | Context-switch cache rule                                                     | —                                                       | none                                               | Clear or scope the cache on context switch                                                                                      | D-SF159-12                             | Test proves no fighter query survives a switch (if decided).                                          |
| P7  | 2 Training    | Client-only boxing timer                                                      | T01–T06, FR6, ST6 (timer prefs)                         | None                                               | State machine, audio, haptics, keep-awake, background, persistence                                                              | D-SF159-13; dependency justification   | [Timer requirements](i-roadmap.md#boxing-timer-requirements) met on physical iOS and Android devices. |
| P8  | 2 Training    | Timer and training log contract                                               | T01 save, T06 RPE, F06                                  | New backend domain                                 | Save summary after a contract exists                                                                                            | D-SF159-05, D-SF159-14                 | Backend ADR and OpenAPI first.                                                                        |
| P9  | 3 Progress    | Progress, camp, weight                                                        | F07, F08, F09, F10, F11                                 | New domains                                        | After backend                                                                                                                   | D-SF159-05                             | Owner-only rules kept (D-SF159-01).                                                                   |
| P10 | 4 Connections | Gym member products (honest request UI)                                       | F16, GC1, GC3, GC5                                      | Exists, grants nothing                             | List products, request, cancel                                                                                                  | D-SF159-16                             | No wording implies purchase or access.                                                                |
| P11 | 5 Social      | Social model, friends, community, messaging, notifications                    | S01–S21, F14, F15, S17, S18, S19                        | New domains                                        | After backend                                                                                                                   | D-SF159-15, 18, 20                     | ADRs approved before any UI.                                                                          |
| P12 | 6 Board       | Live Board                                                                    | B21–B27                                                 | New domain                                         | After P9 and P11                                                                                                                | D-SF159-19                             | Gyms-only location rule.                                                                              |
| P13 | 7 Lifecycle   | Export, deletion, restore, appeal                                             | ST9–ST12, ST15                                          | New (L-09)                                         | After backend                                                                                                                   | D-SF159-17, D-SA29                     | Counsel sign-off.                                                                                     |
| P14 | 8 Commerce    | Fighter Pro, checkout, member billing, PT, programs, events, store, sponsored | F17, F19, PW1, CO*, PS*, CC*, GC4/7/8/12, MK*, SH*, AV* | New, or none by decision                           | None in MVP                                                                                                                     | D-SA21, D-SA23, D-SF159-41, D-SF159-42 | Production NO-GO until decisions change.                                                              |
| P15 | 9 Release     | Native release acceptance                                                     | all built screens                                       | —                                                  | Design QA, device checks, deep links                                                                                            | Whether to add an E2E framework        | `pnpm quality` green; Design QA section per PR.                                                       |
| P16 | Cross-cutting | Route registry resync (platform ↔ mobile)                                     | —                                                       | —                                                  | Docs only, both repos                                                                                                           | None                                   | Both `docs/route-registry.json` copies byte-identical.                                                |
| P17 | Design        | Fix design gaps                                                               | see D-SF159-30..37, 43, 44                              | —                                                  | —                                                                                                                               | Design owner                           | Gaps closed in Claude Design.                                                                         |

## 2. Checklist for each existing SF-158 child issue

Apply to every issue SF-160–SF-186 once Jira is readable:

- [ ] **Duplicate of done work?** Does it repeat SF-18, SF-48, SF-59, SF-66 or
      SF-69 scope, or any item in section 4 below?
- [ ] **UI against a missing API?** Does it build a screen whose data has no
      operation in `openapi/simplefit.api.json` (see
      [Artifact B](b-screen-to-code.md))? If yes, it needs a backend issue
      first or must be marked BLOCKED.
- [ ] **Commercial assumption?** Does it assume prices, payments, trials,
      refunds, inventory or sponsorship? All are NO-GO (D-SA21, D-SA23,
      SF-138).
- [ ] **FUTURE misclassified?** Does it schedule F01, F04, F05, F06, F12, F24
      or S22 as MVP?
- [ ] **Privacy or security missing?** Does it handle body data, location,
      social visibility or account lifecycle without the rules in
      [Artifact E](e-security-privacy.md) or a decision from
      [Artifact H](h-decisions-blockers.md)?
- [ ] **Route correct?** Does it name the registry route id from
      [Artifact A](a-design-inventory.md), not a new path?
- [ ] **States designed?** Does the artboard have loading, empty and error
      states (105 of 109 do not, D-SF159-36)? If not, the issue must say how
      the gap is handled.
- [ ] **Registry drift?** If it edits the route registry, is the resync
      (P16) done first?

## 3. Amendment text blocks

Paste the matching block into the Jira issue whose scope matches the proposal
group. Do not paste a block into an issue whose scope differs.

### For an issue covering core profile and settings (P2–P5)

> Evidence (SF-159): `mobile.profile` and `mobile.settings` are real screens
> but show links and Sign out only. ST2/ST4 can use `getMyAccountProfile`,
> `updateMyAccountProfile`, `listMyEmailIdentities` and
> `updateMyFighterProfile`. Photo, bio, handle change, phone and region have no
> API. ST3's design says "no passwords" while SF-157 added an optional password;
> build ST3 only after decision D-SF159-10. Do not add rows for blocked
> domains as live links.

### For an issue covering restricted accounts (P1)

> Evidence (SF-159): the backend returns `account_suspended` on every sign-in,
> refresh and session use for a suspended account. Mobile has no reference to
> it, and `mobile.account.suspended` is a placeholder. ST14's copy says the
> timer and bookings stay available, which the backend does not allow; the
> notice copy needs counsel (D-SA29). Appeal (ST15) has no backend.

### For an issue covering the boxing timer (P7)

> Evidence (SF-159): `mobile.timer` and `mobile.timer.run` are placeholders.
> The timer is client-only and needs no backend. Presets, sounds and phases
> come from `TimerLive.dc.html` and `FlowTimer.dc.html`; T02, T05 and T06 are
> phases of `TimerLive`, not separate boards. Time must come from monotonic
> timestamps, not tick counting. Saving to a training log is out of scope
> until a backend contract exists (D-SF159-14). New dependencies (audio,
> haptics, keep-awake) need justification per `CLAUDE.md` rule 26.

### For an issue covering training, progress, camp or weight (P8, P9)

> Evidence (SF-159): completion has no body (ADR 0023); there is no training
> log, RPE, weight history, camp, progress or video domain. Body data is
> owner-only (ADR 0015). A health-data ADR is required first (D-SF159-05).
> F04, F05, F06, F12 and F24 are FUTURE in the design.

### For an issue covering gym membership or member billing (P10)

> Evidence (SF-159): `listMyGymProducts`, `requestMyGymProduct`,
> `listMyProductSubscriptions` and `cancelMyProductSubscription` exist but are
> unused. A request stays `pending_activation` and grants nothing; there is no
> member checkout, credits ledger or drop-in purchase (D-G10). UI copy must not
> imply a purchase (D-SF159-16). My gyms, join and class booking are already
> built (SF-100, SF-135).

### For an issue covering social, community, messaging or notifications (P11, P12)

> Evidence (SF-159): no social, friends, feed, messaging, notification,
> challenge or Live Board domain exists. D-SA32 (approved) rules out a
> moderation domain, so report/block cannot be built. Decisions D-SF159-15,
> 18, 19 and 20 are needed before UI work; until then the routes stay
> placeholders.

### For an issue covering account deletion, export or appeal (P13)

> Evidence (SF-159): deletion, restore, export and appeal do not exist;
> only email templates do. D-SA17 (proposed, not approved) would exclude deletion and export from the MVP;
> L-09 defines the intended workflow but is not built or legally approved.

### For an issue covering any commerce surface (P14)

> Evidence (SF-159): Fighter Mobile commerce is production NO-GO. Stripe is
> off by default and Live is gated by `STRIPE_LIVE_APPROVAL`; SF-138 is NO-GO;
> D-SA23 (proposed, not approved) would rule out monetization in the MVP; D-SA21 (approved) rules out a marketplace and
> inventory; entitlements are `enforced: false`. PS1–PS5 show Coach Pro and
> continue to the coach home. Keep these routes as placeholders.

## 4. Work already done (do not re-ticket)

### simplefit-mobile (`main` `6f59346`)

| Ticket                                          | What                                                               | Commits                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| SF-25                                           | Fighter profile client sync                                        | `1f5c5bf`, `24cca8a`, `5dfa897`                                             |
| SF-26                                           | Fighter onboarding mobile integration                              | `6501bb4`, `7aedf4a`, `e3bedbf`                                             |
| SF-28                                           | Sign-out, session boundaries, recovery (query cache cleared)       | `5850402`, `c4e1ec6`                                                        |
| SF-39                                           | Fighter registration 11-step flow                                  | `dee947f`, `a0d60b3`                                                        |
| SF-41                                           | Fighter first-run experience (FR1–FR5)                             | `674e332`, `00fa216`, `d11b6dd`                                             |
| SF-45                                           | Entry resolution through the backend                               | `02c2b08`, `c4c19ac`, `fd23b53`                                             |
| SF-51                                           | Coach capability entry resolution, context switching               | `6fbf38d`                                                                   |
| SF-56, SF-57, SF-62, SF-63, SF-73, SF-74, SF-77 | API client regeneration for the fighter domains                    | `09036db`, `1f8fb31`, `dc216f4`, `23ce676`, `8293b9e`, `e9d2e9f`, `57e0675` |
| SF-58                                           | Route registry sync (coach web fighters)                           | `8de5c71`                                                                   |
| SF-59                                           | Fighter coaches and relationship ending (FC1, FC2)                 | `062ed6b`, `f278091`                                                        |
| SF-66                                           | Fighter training schedule, detail, completion (FT1, FT2)           | `4abbdef`, `bfd1961`                                                        |
| SF-69                                           | Real training data on fighter home                                 | `ba4a1f2`, `551bfe0`, `92b9d84`, `fba2a8e`                                  |
| SF-76                                           | Fighter coach invitations and relationship detail (FCI1, FCI2)     | `69c82a8`, `96f41a8`                                                        |
| SF-79                                           | Verify an email from coach invitations (FCI3)                      | `e36e939`, `501412e`, `9dcbee4`                                             |
| SF-80                                           | Verified invitation links (`+native-intent`)                       | `06ae737`, `7fd3ed0`, `849d0e7`                                             |
| SF-88                                           | Route registry and architecture doc sync (mention only)            | `0a4f38b`                                                                   |
| SF-100                                          | Gym member booking, classes, rosters on mobile (F13)               | `9f665b2`, `74d15c5`                                                        |
| SF-101, SF-102                                  | API client regeneration for plans, member products, Stripe billing | `0ecdb59`, `65c5d09`                                                        |
| SF-135                                          | Native gym member join, invitation inbox, My gyms                  | `83ef85a`, `0f94b40`                                                        |
| SF-157                                          | API client regeneration for password sign-in                       | `6f59346`, `c831675`                                                        |

SF-18 and SF-48 have no commits on mobile `main` (SF-48 is mentioned once in
the API, in the SF-49 proposal commit `3cf1f96`). If an SF-158 child issue
repeats SF-18 or SF-48 scope, check those issues in Jira first.

### simplefit-api (`main` `3afa381`)

| Ticket | What                                         | First commit |
| ------ | -------------------------------------------- | ------------ |
| SF-25  | Fighter profile domain                       | `6434399`    |
| SF-41  | Fighter mobile first-run                     | `2f94eff`    |
| SF-45  | Entry resolution                             | `20861e6`    |
| SF-56  | Coach–fighter relationship domain            | `9d5d52b`    |
| SF-57  | Coach invitations and fighter acceptance     | `d78f90d`    |
| SF-62  | Training session domain                      | `9281171`    |
| SF-63  | Training completion and projections          | `733b1c5`    |
| SF-73  | Fighter incoming coach invitations inbox     | `68085f2`    |
| SF-74  | Fighter's coach relationship by id           | `b1f5243`    |
| SF-77  | Verified email identity linking              | `7d31075`    |
| SF-99  | Gym class booking                            | `1de9657`    |
| SF-101 | Gym plans, member products, entitlements     | `5a9d2a8`    |
| SF-102 | Stripe for gym SaaS billing                  | `0329866`    |
| SF-122 | Account suspension                           | `f11e380`    |
| SF-130 | Sponsor partnership proposals (no inventory) | `54b4e10`    |
| SF-157 | Optional password credential                 | `f14124d`    |
