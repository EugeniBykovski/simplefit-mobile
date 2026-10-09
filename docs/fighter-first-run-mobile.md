# Mobile Fighter first run (SF-41)

The Fighter mobile first-run experience against Claude Design section
**FIGHTER · 34a · Onboarding · mobile first run · 7-step tour** (version
`1791551058-4322`, 390 × 844 / 980), on the SF-40 FirstRun API (simplefit-api
ADR 0018, amended for SF-41), the SF-25 FighterProfile and the SF-45 entry.

## Inventory

| Artboard                       | Source                             | Production                         | Route                   | Backend                             | Status                                      |
| ------------------------------ | ---------------------------------- | ---------------------------------- | ----------------------- | ----------------------------------- | ------------------------------------------- |
| FR1 Intro · Live Board         | `FirstRunF1.dc.html`               | `FirstRunIntroScreen`, `BoardArt`  | `mobile.welcome.tour`   | FirstRun `fighter_mobile_first_run` | current; generic labels (decision)          |
| FR2 Intro · Round timer        | `FirstRunF2.dc.html`               | `FirstRunIntroScreen`, `TimerArt`  | `mobile.welcome.tour`   | same                                | current; generic labels (decision)          |
| FR3 Intro · Coach & gym        | `FirstRunF3.dc.html`               | `FirstRunIntroScreen`, `CornerArt` | `mobile.welcome.tour`   | same: `completed` / `dismissed`     | current; generic labels (decision)          |
| FR4 Home · checklist           | `FirstRunFHome.dc.html`            | `FighterHomeScreen`                | `mobile.home`           | FighterProfile, FirstRun            | current; steps not available yet (decision) |
| FR5 Product tour (7 + ✓)       | `FirstRunFBoardTip(Steps).dc.html` | `HomeTour`, `Spotlight`            | `mobile.home` (overlay) | none (help; records nothing)        | current                                     |
| FR6 Tip · Round timer          | `FirstRunFTimerTip.dc.html`        | —                                  | `mobile.timer`          | no round timer                      | deferred to the timer ticket (decision)     |
| FR7 Milestone · first training | `FirstRunFDone.dc.html`            | —                                  | `mobile.home`           | no training log                     | deferred to the training ticket (decision)  |

Code: `entities/first-run` (state and outcome), `widgets/first-run-intro`
(FR1–FR3), `widgets/fighter-home` (FR4, FR5), `shared/ui/spotlight` (coach
marks on mounted UI), `shared/ui/brand-mark` (`BrandMark`), the Fighter tab
bar registers its buttons as spotlight targets (`tab:<item>`).

## Lifecycle

```text
OF11 → SF-45 fighter_home → /home
  FirstRun fighter_mobile_first_run
    pending              → /welcome/tour (FR1–FR3)
                             "Let’s go"  → PUT completed → /home
                             "Skip intro" → PUT dismissed → /home
    completed, dismissed → Fighter home (FR4); /welcome/tour leads here too
    unavailable          → "/" (the entry: O04 or Fighter onboarding)
```

- **Mobile has its own experience.** `fighter_mobile_first_run` has the web
  tour's availability (a completed Fighter onboarding) and its own outcome.
  Finishing the web tour does not finish the mobile introduction, and the
  other way round.
- **Only an explicit action records.** Visiting a slide records nothing; an
  unfinished introduction stays `pending` and starts again at FR1 (the slide
  is screen state; there is no step cursor). The first outcome is final on
  every device: a later client receives the kept one and moves on.
- **Failure.** A failed save stays on the slide with a message and a retry;
  nothing moves on and nothing is shown as done.
- **Rollout.** A Fighter who completed onboarding before SF-41 has no mobile
  outcome, so the introduction is offered once (`pending`); one action ends
  it for good. Nothing is backfilled.
- **Accounts.** The query cache is cleared when the session ends or another
  user signs in (SF-26), and in-flight requests of the previous user are
  cancelled: one account's first-run state never reaches another.

## Home and tour

- Real data only: the display name (identity pill, greeting) and the day
  since Fighter onboarding completed. The checklist's five steps (gym,
  classes, round timer, training log, partners) wait for their domains: no
  tick, no detail, no link, "Not available yet" (as the web home). The Live
  Board card shows its empty state.
- The tour (FR5) opens from Help (?) or the Live Board card, measures each
  real target (checklist, the Live Board, Training, Community and Profile
  tabs, Notifications, the identity pill) when its step shows, and places
  the card on the side with room, on screen. It records nothing and every
  opening starts at step 1. No animation when the system reduces motion.

## Verification

- Unit / component: `entities` via the screens, `fighter-home/model` (day
  and date), `shared/ui/spotlight.test.tsx` (card placement),
  `first-run-intro-screen.test.tsx` (order, Skip, Let’s go, failure + retry,
  another device first, completed / dismissed / unavailable, Android Back),
  `fighter-home-screen.test.tsx` (pending → introduction, unavailable →
  entry, real data only, the tour's seven steps, Back, End tour, replay, no
  write), `providers/session-cache.test.tsx` (late answer of the previous
  user dropped), `providers/router.test.tsx` (real route tree: pending →
  introduction, completed / dismissed → home, web tour does not count,
  unavailable → O04).
- iOS dev build (EAS simulator build, unchanged native code), local Phoenix
  - PostgreSQL, no mocks. Account A on iPhone 14 (390 × 844): sign-up → O04 →
    O05 → OF1–OF11 → SF-45 → FR1–FR3 → "Let’s go" → one `completed` row →
    Fighter home; the FR5 tour (7 steps + done) on the real header, checklist
    and tabs; a cold restart opened the home, no introduction. Account B (web
    tour recorded `completed` first): the mobile introduction still showed;
    "Skip intro" → `dismissed` → B's own home (nothing of A), and a restart
    kept it. Database: 2 users, 2 profiles, 3 outcomes (one per user and
    experience). B's home and the tour also checked on iPhone 15 Plus
    (430 × 932).
- Not verified: 375 × 812 (the automated sign-in did not complete there),
  Android (no emulator), VoiceOver / TalkBack, a real Google or Apple
  sign-in.
- Backend: `first_run_test.exs`, `first_run_controller_test.exs` (mobile
  availability, independence from the web tour, first outcome kept).
