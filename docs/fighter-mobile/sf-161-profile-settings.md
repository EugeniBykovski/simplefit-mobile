# SF-161 · Profile, account details, privacy and settings

Epic SF-158 (Fighter Mobile). This page builds on the [SF-159 inventory](README.md) and the
[SF-160 shell](sf-160-five-tab-shell.md). It records what SF-161 verified and built, and what it
left open.

## Design source

| Item                                             | Value                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Artifact                                         | `JEsBg51MjX8KiHWEro8omY`                                                                                                                                                                                                                                                                                                                                                                            |
| Version read                                     | `1794843261-39f9` (2026-11-16), read with the Artifact tool; newer than SF-160's `1794841517-868f`                                                                                                                                                                                                                                                                                                  |
| Artboards (canvas titles, page `fighter-mobile`) | 7.1 F18 Profile · 8.1 ST1 Settings hub · 8.2 ST2 Account details · 8.3 ST3 Sign-in & security · 8.4 ST4 Edit profile · 8.5 S19 Privacy · 8.6 S18 Notifications · 8.7 ST5 Blocked & muted · 8.8 ST6 Training & timer · 8.9 ST7 Connected apps · 8.10 ST8 Memberships & billing · 8.11 ST9 Your data · 8.13–8.14 ST10–ST12 deletion · 8.15 ST13 Help & legal · 8.16 ST14 Suspended · 8.17 ST15 Appeal |
| ID corrections to the brief                      | The brief's "ST8 Training & Timer", "ST9 Connected Apps", "ST11 Your Data" and "ST15 Help & Legal" are ST6, ST7, ST9 and ST13 in the design. ST8 is Memberships & billing, ST11 is the delete confirmation and ST15 is the appeal (D-SF161-01)                                                                                                                                                      |
| `Profile.dc.html` (F18)                          | Unchanged since SF-160 (sha256 `e589fc74…`)                                                                                                                                                                                                                                                                                                                                                         |

## Preflight matrix

**Existing API** lists what the backend served before SF-161. **SF-161** lists what this ticket built.

| Screen                | Artboard | Existing UI                             | Existing API                                   | Approved write                                                                     | SF-161                                                                              |
| --------------------- | -------- | --------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Fighter profile       | F18      | SF-160 real profile                     | `getMyFighterProfile`                          | —                                                                                  | Unchanged; Settings and ST4 reach it                                                |
| Settings              | ST1      | Sign out only                           | account profile, entry                         | —                                                                                  | Hub on real data; every row opens a real screen; Delete disabled                    |
| Account details       | ST2      | Placeholder                             | `getMyAccountProfile`, `listMyEmailIdentities` | `full_name` (`updateMyAccountProfile`); date of birth immutable after registration | Full name edit, emails and date of birth read-only, language                        |
| Sign-in & security    | ST3      | Placeholder                             | No list of providers                           | None (passwordless public apps, D-SF157-02)                                        | **New** `GET /api/v1/me/sign-in-methods` (`listMySignInMethods`); list and sign out |
| Edit profile          | ST4      | Placeholder                             | `get/updateMyFighterProfile`                   | FighterProfile fields (ADR 0015)                                                   | Completed profiles only; changed fields only                                        |
| Privacy               | S19      | Placeholder                             | None                                           | None                                                                               | The rules the backend enforces, read-only                                           |
| Blocked & muted       | ST5      | Placeholder                             | None (D-SA32)                                  | None                                                                               | Not available                                                                       |
| Notifications         | S18      | Placeholder                             | `product_news` consent                         | `product_news` (append-only)                                                       | Product news switch                                                                 |
| Training & timer      | ST6      | Placeholder                             | None                                           | None                                                                               | Not available                                                                       |
| Connected apps        | ST7      | Placeholder                             | None                                           | None                                                                               | Not available                                                                       |
| Memberships & billing | ST8      | Placeholder (`mobile.settings.billing`) | Gym memberships                                | —                                                                                  | Row opens My gyms (MMG1); billing is SF-181                                         |
| Your data             | ST9      | Placeholder                             | None (export and deletion are SF-180)          | None                                                                               | Kept-data categories; export and deletion stated as unavailable                     |
| Help & legal          | ST13     | Placeholder                             | Consents; `getLegalDocument` (coach notice)    | —                                                                                  | Accepted versions and the published coach notice                                    |

## Backend change (simplefit-api)

`GET /api/v1/me/sign-in-methods` (`listMySignInMethods`, tag Account, bearer only) returns
`SimpleFit.Accounts.list_sign_in_methods/1`:

- It lists every identity of the viewer, oldest first; methods added in the same second are ordered by provider.
- It returns each method's `provider`, `email` and `linked_at`. `email` is set only for an email identity.
- It never returns a provider subject, a provider-reported email or any credential, and never another user's identities.
- It has no new table and no migration.
- The OpenAPI artifact was regenerated (sha256 `c8aaf78a…`). The copies in simplefit-api, simplefit-mobile and simplefit-platform are identical, and both clients were regenerated with Orval.

## Decisions and discrepancies

| Id         | Subject                                                                                                                                                                                                                                   | Status                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| D-SF161-01 | The brief's artboard IDs differ from the design; the design's IDs are used                                                                                                                                                                | Recorded                                      |
| D-SF161-02 | ST3 shows no password, passkey or session list: public apps are passwordless (D-SF157-02, APPROVED), and the design marks them `data-not-current`. "Sign-in emails (E10)" are not sent by the backend, so ST3's Alerts section is omitted | Accepted                                      |
| D-SF161-03 | ST2's phone, region and currency, handle cadence and workspaces have no account field. No email change contract exists, so emails are read-only (linking another address stays the existing FCI3 flow)                                    | Open: product/backend                         |
| D-SF161-04 | ST4's photo, bio, home gym and "on your profile" switches have no field or upload endpoint; ST4 edits the existing FighterProfile fields                                                                                                  | Open: product/backend                         |
| D-SF161-05 | S19's switches would govern projections that do not exist (public profile, discovery, shared training). A local-only switch is not a privacy control, so the screen states the enforced rules instead                                     | Open until the social domains (SF-173–SF-177) |
| D-SF161-06 | S18 offers only the stored product news consent; categories, channels, digest and quiet hours wait for notification delivery (SF-167)                                                                                                     | Open (SF-167)                                 |
| D-SF161-07 | ST9 shows no export, deletion or retention period: no API exists and no retention policy is approved (SF-180)                                                                                                                             | Open (SF-180, counsel)                        |
| D-SF161-08 | ST13: the Terms and Privacy texts are not published to the app, and there is no support channel, help search, guidelines or licence page                                                                                                  | Open: product/legal                           |
| D-SF161-09 | ST8 Memberships & billing opens My gyms; billing is SF-181. Delete account is a disabled row (SF-180)                                                                                                                                     | Accepted                                      |

## Verification

Final results are in the SF-161 engineering report. In summary:

- **API:** `test/simple_fit_web/controllers/sign_in_method_controller_test.exs` covers the contract,
  each provider, no leaked subject or claim, linking and isolation. `mix quality`, `mix test --warnings-as-errors`,
  `mix openapi.gen` and `mix openapi.check` were run.
- **Mobile Jest:** `router.test.tsx` "Settings (SF-161)", 18 tests: hub, Coach-only, ST2 save,
  validation and failure, ST3, ST4 changed fields and backend rules, the discard guard, S18 persistence and
  failure, the truthful screens, ST13, three locales, and account isolation.
- **Real Phoenix and PostgreSQL:** `src/providers/account-settings.real-api.test.tsx` runs scenarios A–G
  (opt-in, disposable `*e2e*` database, never port 4000):

  ```bash
  E2E_REAL_API_URL=http://127.0.0.1:<port> \
  E2E_API_DATABASE_URL=postgres://…/<…e2e…> E2E_API_DIR=../simplefit-api \
  npx jest src/providers/account-settings.real-api.test.tsx --forceExit
  ```

- **Native iOS and Android:** not run on this machine. There is no simulator input automation and no
  Android SDK.
