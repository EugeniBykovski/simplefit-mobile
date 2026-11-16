# Fighter Mobile inventory (SF-159)

SF-159 "Fighter Mobile: complete Claude Design artboard, route & backend
inventory", epic SF-158. This folder records what the Fighter Mobile design
contains, what the mobile app and the backend implement today, and what is
missing, blocked or undecided. It is documentation only: no code, route
registry, generated client, Jira issue or Claude Design file was changed.

## Artifacts

| Artifact | File                                                   | Content                                                                                                |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| A        | [a-design-inventory.md](a-design-inventory.md)         | Every fighter-mobile board (113) and the fighter-relevant boards on other pages, with route and status |
| B        | [b-screen-to-code.md](b-screen-to-code.md)             | Artboard → mobile module → API operation → backend owner                                               |
| C        | [c-navigation-flows.md](c-navigation-flows.md)         | Five tab trees, per-destination access, key flows, context-switch safety                               |
| D        | [d-domain-gaps.md](d-domain-gaps.md)                   | Domain gaps, existing domain detail, API contract and route-registry parity                            |
| E        | [e-security-privacy.md](e-security-privacy.md)         | Ownership, visibility, consent, retention, cache isolation, lifecycle                                  |
| F        | [f-commercial-readiness.md](f-commercial-readiness.md) | Commercial surfaces, GO/NO-GO, design inconsistencies                                                  |
| G        | [g-jira-reconciliation.md](g-jira-reconciliation.md)   | Jira reconciliation (BLOCKED), proposed breakdown, amendments, done work                               |
| H        | [h-decisions-blockers.md](h-decisions-blockers.md)     | Register `D-SF159-01`… of decisions, blockers and design gaps                                          |
| I        | [i-roadmap.md](i-roadmap.md)                           | Dependency-aware order, start-now items, boxing timer requirements                                     |
| SF-160   | [sf-160-five-tab-shell.md](sf-160-five-tab-shell.md)   | Five-tab shell, route reconciliation, workspace isolation, design discrepancies `D-SF160-*`            |

## Scope

- Claude Design page `fighter-mobile` ("Fighter Mobile"): 113 boards, of which
  4 are flow sheets (FlowFighter, FlowLifecycle, FlowSocial, FlowTimer) and 109
  are screen boards, in sections 6, 7, 8, 9, 10, 11, 21, 23, 25, 26, 27, 28
  and 30.
- Fighter-relevant boards on other pages: FR1–FR7 and QA1 (onboarding),
  FighterTabs and ContextSwitcher (design-system), PR1m, CC1, CC6m, C04
  (coach-mobile), PR6m (gym-mobile), CO1, CO5, CC2, CC6–CC10, GC2, GC6,
  GC9–GC11, MK1d, SH0 (desktop-web).
- The fighter-facing parts of `simplefit-mobile`, `simplefit-api` and
  `simplefit-platform` (only where the platform shares the registry, spec or
  client).

## Method

1. **Design.** `project/canvas.json` and each `project/<Name>.dc.html` were
   read read-only through the artifact file API. Titles, `data-props` enums,
   hrefs, in-board labels and copy were extracted per board. No design file is
   committed here (the repository test forbids `*.dc.html` and `canvas.json`);
   only names are referenced.
2. **Mobile.** Route files, widgets, features, tests and the generated client
   in this repository were read. Every `mobile.*` route in
   `docs/route-registry.json` was checked for a real screen or a
   `placeholderRoute(...)` file.
3. **Backend.** `simplefit-api` contexts, router, migrations, config, ADRs and
   decision registers were read. No migration was run and no database was
   touched.
4. **Contract.** The three OpenAPI snapshots were hashed; every operationId was
   checked for generation and use in both clients; error-code references were
   counted.
5. **Registry.** Both copies of `docs/route-registry.json` and
   `docs/route-architecture.md` were compared.

## Sources

| Source                       | Identity                                                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Design artifact       | `JEsBg51MjX8KiHWEro8omY` (uuid `8b9af407-4197-4905-87b7-0ebf86bf35e7`), "SimpleFit Boxing — Product design", page `fighter-mobile`                                           |
| Read on                      | 2026-11-16, read-only                                                                                                                                                        |
| Design version               | File listing at `1794760506-29fa`; all files downloaded at `1794821244-6c73`. Another writer was active and the version moved during the audit.                              |
| `canvas.json`                | sha256 `7e3104752336e0353d870b51534d784f887881ada30c8bd636cadaeed9fe2817`                                                                                                    |
| `FlowFighter.dc.html`        | sha256 `143762e9056a83c520a0f5a3dc72af949dafc6fbfce0354bf1182992b01af231`                                                                                                    |
| Earlier recorded versions    | `docs/design-source.json`: SF-16 audit `1791206633-31de`, SF-31 registry `1791276973-ad1d`; registry `source.version` `1791448557-b0b9`; SF-66 Version 106 `1792569354-73b2` |
| OpenAPI                      | `openapi/simplefit.api.json` sha256 `698773358e9abde2f50c48d1bea56cc349dbe40777a6dbdef809b44620fccfef`, identical in all three repos, 288 operations                         |
| Route registry (mobile copy) | `docs/route-registry.json` sha256 `1089f3b6cb93dbba7f0ec4d6794d5b7a63991035e4023b1a1363323d92a94fb0`                                                                         |

## Starting git state

| Repository         | Branch | Commit                                     | Working tree |
| ------------------ | ------ | ------------------------------------------ | ------------ |
| simplefit-api      | `main` | `3afa381c02756f99e438aaf5536269aad3e7c82a` | clean        |
| simplefit-mobile   | `main` | `6f593462588dac1d5739870fe1484667fb7f29ed` | clean        |
| simplefit-platform | `main` | `06aec9aa781e1fb364e517d45b44ec607de428bc` | clean        |

This folder was written in the worktree
`.worktrees/sf-159/simplefit-mobile` on branch
`SF-159-fighter-mobile-inventory`, based on `main` `6f59346`.

Jira was not accessible (no Jira CLI or connector). Claude Design was not
modified. No code was changed.

## Status vocabulary

| Status      | Meaning                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| IMPLEMENTED | A real screen (not a placeholder) covers the board's current scope against the real API.                                               |
| PARTIAL     | A real screen exists but covers only part of the board's current scope.                                                                |
| MISSING     | Not built (placeholder route file or no file), and it can be built now: the backend contract exists or none is needed.                 |
| BLOCKED     | Not built, and it cannot be built until a backend domain, ADR, legal or product decision exists, or an approved decision rules it out. |
| FUTURE      | Claude Design labels the board FUTURE. The label is always kept, whatever the code does.                                               |
| UNVERIFIED  | The evidence needed to classify it was not available.                                                                                  |

Rules: registry `status: IMPLEMENTED` only means a route file exists. A
placeholder route file is never IMPLEMENTED. Flow sheets are not screens and
carry `n/a`.

## How to keep this current

- Re-read the design with the Artifact tool, record the new version in the
  Sources table, and update Artifact A rows whose title, states or labels
  changed.
- When a ticket replaces a placeholder with a real screen, update its rows in
  Artifacts A, B and C and close the related `D-SF159-*` entries in H.
- When the API spec changes, recompute the contract parity in Artifact D
  (operation count, mobile usage, error codes).
- Keep route ids from `docs/route-registry.json`; never add a route here that
  is not in the registry. Rerun the checks below.
- Never commit `*.dc.html` or `canvas.json`.

## Validation evidence

All checks were read-only. Nothing was migrated, regenerated or run against a
database.

| Check                                                                                                                                              | Result                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Artboard ids in Artifact A vs `canvas.json` titles (scripted)                                                                                      | 118 ids checked. 113 match a canvas title literally. 5 match in another form: F24 (`hub(F24, FUTURE)` in the FT1 title), S04 (`S04/05`), T02, T05, T06 (FlowTimer nodes only, no boards: D-SF159-30). None invented.                                  |
| `mobile.*` / `web.*` route ids cited in these files vs `docs/route-registry.json` (scripted)                                                       | 267 references checked. All exist in this repository's registry except `web.admin.password` and `web.sponsor.interests`, which exist only in the platform copy; they are cited to describe that drift (D-SF159-25).                                   |
| `pnpm exec jest scripts/design-handoff.test.js scripts/route-registry.test.js scripts/mobile-route-skeleton.test.js scripts/mobile-routes.test.js` | 4 suites, 91 tests passed (no design copies committed; registry and route skeleton unchanged).                                                                                                                                                        |
| `pnpm exec prettier --check docs/fighter-mobile`                                                                                                   | Passes after `prettier --write`.                                                                                                                                                                                                                      |
| Decision statuses cited as approved                                                                                                                | Checked against `simplefit-api/docs/architecture/sponsor-admin-decision-register.md` and `proposals/SF-82-gym/10-decision-register.md`: D-SA21, D-SA29, D-SA32, D-G02, D-G06, D-G22 approved; D-SA17 and D-SA23 PROPOSED; D-G10 deferred; D-G19 open. |
| OpenAPI copies                                                                                                                                     | `simplefit-api`, `simplefit-mobile`, `simplefit-platform` `openapi/simplefit.api.json` byte-identical (sha256 above), 288 operations; generated clients byte-identical. `mix openapi.check` (spec vs API code) not run: D-SF159-24.                   |
| End-to-end                                                                                                                                         | Not run. No feature is claimed verified end to end because tests exist.                                                                                                                                                                               |

## Acceptance matrix

The SF-159 acceptance criteria, as given in the task brief (the Jira text
itself was not readable, D-SF159-46).

| #   | Criterion                                                                | Result  | Evidence or reason                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Latest Fighter Mobile design source is verified                          | PASS    | Read live through the artifact file API on 2026-11-16 ([Sources](#sources)).                                                                                                             |
| 2   | Exact artifact version is recorded                                       | PASS    | `1794821244-6c73` (files); listing `1794760506-29fa`; the version moved during the audit (D-SF159-38).                                                                                   |
| 3   | All visible design sections are inventoried                              | PASS    | Sections 6, 7, 8, 9, 10, 11, 21, 23, 25, 26, 27, 28, 30 on `fighter-mobile`, plus fighter-relevant boards elsewhere ([A](a-design-inventory.md)).                                        |
| 4   | Every verified screen has an exact artboard ID                           | PASS    | 109 screens with canvas ids; flow sheets marked as such. Brief-named screens that have no board (T02, T05, T06, ST16, ST17, export requests) are recorded as design gaps, not given ids. |
| 5   | All five primary tabs are mapped                                         | PASS    | [C](c-navigation-flows.md) §1–5.                                                                                                                                                         |
| 6   | All significant navigation flows are mapped                              | PASS    | [C](c-navigation-flows.md) Mermaid flows.                                                                                                                                                |
| 7   | Every implemented screen is identified through actual code               | PASS    | Route file kind checked for every `mobile.*` route ([A](a-design-inventory.md), [B](b-screen-to-code.md)).                                                                               |
| 8   | Every missing screen is identified                                       | PASS    | 112 placeholder routes and every board without a route ([A](a-design-inventory.md)).                                                                                                     |
| 9   | Every PARTIAL feature has a precise gap                                  | PASS    | "Missing Work" column in [B](b-screen-to-code.md).                                                                                                                                       |
| 10  | Existing onboarding/coaching work is not duplicated                      | PASS    | Done work with SHAs, not to be re-ticketed ([G](g-jira-reconciliation.md) §4).                                                                                                           |
| 11  | Backend domains are inventoried                                          | PASS    | [D](d-domain-gaps.md), all 30 domains.                                                                                                                                                   |
| 12  | API operations are verified                                              | PARTIAL | All 288 operationIds read from the committed spec and matched to clients; spec-vs-server parity (`mix openapi.check`) not run (D-SF159-24).                                              |
| 13  | Generated-client parity is analyzed                                      | PASS    | [D](d-domain-gaps.md) contract parity.                                                                                                                                                   |
| 14  | Route registry parity is analyzed                                        | PASS    | [D](d-domain-gaps.md); drift D-SF159-25.                                                                                                                                                 |
| 15  | Authorization ownership is documented                                    | PASS    | [E](e-security-privacy.md).                                                                                                                                                              |
| 16  | Coach/Fighter/Gym privacy boundaries are documented                      | PASS    | [E](e-security-privacy.md) (ADR 0015/0021, D-G06).                                                                                                                                       |
| 17  | Social permissions and consent are assessed                              | PASS    | [E](e-security-privacy.md); no social domain, decision D-SF159-15.                                                                                                                       |
| 18  | Live Board data and privacy requirements are assessed                    | PASS    | [C](c-navigation-flows.md), [E](e-security-privacy.md); D-SF159-19, D-SF159-21.                                                                                                          |
| 19  | Boxing Timer state/lifecycle requirements are documented                 | PASS    | [I](i-roadmap.md) timer requirements; D-SF159-13/14/23/30.                                                                                                                               |
| 20  | Progress/Weight/Fight Camp provenance is assessed                        | PASS    | [D](d-domain-gaps.md), [E](e-security-privacy.md); owner-only profile fields only; health-data ADR D-SF159-05.                                                                           |
| 21  | Account deletion/suspension/appeal policies are assessed                 | PASS    | [E](e-security-privacy.md); D-SA29 (approved), D-SA17 (proposed), L-09, D-SF159-11/17.                                                                                                   |
| 22  | Commerce is assessed independently of design                             | PASS    | [F](f-commercial-readiness.md).                                                                                                                                                          |
| 23  | No fabricated inventory or metric assumptions are introduced             | PASS    | Design amounts are labelled mock data; no inventory or metric is asserted as real.                                                                                                       |
| 24  | No unsupported payments are marked production-ready                      | PASS    | Every commercial surface production NO-GO ([F](f-commercial-readiness.md)).                                                                                                              |
| 25  | FUTURE and BLOCKED states are preserved                                  | PASS    | Design FUTURE labels kept in [A](a-design-inventory.md).                                                                                                                                 |
| 26  | SF-158 Jira task coverage is reconciled                                  | BLOCKED | Jira not accessible; a proposed breakdown and checklist are in [G](g-jira-reconciliation.md) (D-SF159-46).                                                                               |
| 27  | Duplicate and missing tasks are identified                               | PARTIAL | Done work that must not be re-ticketed and missing work are identified; duplicates among SF-160–SF-186 cannot be named without Jira.                                                     |
| 28  | Required product/ADR decisions are documented                            | PASS    | [H](h-decisions-blockers.md).                                                                                                                                                            |
| 29  | Detailed implementation order is produced                                | PASS    | [I](i-roadmap.md).                                                                                                                                                                       |
| 30  | Documentation is persisted in the repository                             | PASS    | `docs/fighter-mobile/` in `simplefit-mobile`, committed locally on `SF-159-fighter-mobile-inventory`.                                                                                    |
| 31  | Exact source references and SHAs are reported                            | PASS    | [Sources](#sources), [Starting git state](#starting-git-state), file:line citations.                                                                                                     |
| 32  | No unauthorized feature implementation occurs                            | PASS    | Only Markdown under `docs/fighter-mobile/` was added.                                                                                                                                    |
| 33  | No unauthorized push, PR, merge, deployment or Jira/design change occurs | PASS    | None performed.                                                                                                                                                                          |
