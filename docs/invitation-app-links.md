# Verified invitation links (SF-80)

How a Coach invitation email (E08, SF-57) opens the installed app on iOS
(Universal Links) and Android (verified App Links), and why the app never
uses the invitation token.

## The link

simplefit-api builds the E08 link as `<WEB_APP_URL>/invite/coach#token=sfi_…`
(`Coaching.Invitations`). The token is a one-time credential. It lives in the
fragment, which browsers never send to a server. The web page (SF-60) reads it
once, drops the fragment and sends the token only in SF-57 request bodies.

## Decision: a navigation entry, not a token handoff

The app claims exactly `https://<app link host>/invite/coach`. When the OS
opens it, the app **discards the fragment** and leads to the fighter's own
invitation inbox:

1. `src/app/+native-intent.tsx` (`redirectSystemPath`) receives every URL the
   system opens the app with (a cold start and every later link) before Expo
   Router reads it. `systemPathOf` (`features/coach-invitation-link`) maps it:
   - `https://<app link host>/invite/coach` (any query or fragment) →
     `/login?returnTo=/profile/coaches/invitations&intent=fighter`;
   - `/invite/coach` without an origin, and `simplefit://invite/coach` → the
     same;
   - any other path on the app link host → `/`;
   - everything else → unchanged, **minus any fragment**.
2. The existing gates do the rest:
   - A signed-out visitor sees sign-in (A02).
   - A signed-in user is sent on to the entry (SF-45). The entry resolves
     account registration and Fighter onboarding first; the continuation
     rides along.
   - The entry then opens FCI1 Invitations (SF-73). There the backend lists
     only invitations sent to the fighter's **verified** email identities.
3. The fighter opens FCI2, reads the current disclosure and accepts or
   declines **explicitly** (SF-76). A Google- or Apple-only fighter adds the
   invited address first with FCI3 (SF-79, "Missing an invitation?").

Opening a link only navigates. It sends no request with the token, changes no
invitation status and creates nothing. ADR 0021's recipient binding is
untouched: the backend decides which invitations a user can see and accept.

### Options considered

| Option                                   | Verdict                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Use the `#token=` fragment in the app | Rejected. Expo Router copies a fragment into the route param `#` (navigation state). The session gate then copies every route param into `returnTo`, so the token would travel as `returnTo=/invite/coach?%23=token%3D…`. Proven by the mutation test in `src/providers/router.test.tsx`. It would also add a second, token-based invitation flow next to SF-73/SF-76. |
| B. Opaque one-time handoff               | Not needed. A handoff id in a URL is itself a credential, and it would need a new backend endpoint (an ADR 0021 change) for no gain over C.                                                                                                                                                                                                                            |
| **C. Authenticated inbox (chosen)**      | No token in the app at all, no backend or email change, and it reuses the existing recipient binding, explicit acceptance and replay protection. Cost: a signed-out recipient sees sign-in without a preview of the invitation (the web page keeps its anonymous preview).                                                                                             |

## Threat model (summary)

| Threat                                                                  | Handling                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Token in navigation state, `returnTo`, logs, storage, analytics, Sentry | The fragment is dropped before routing. The app has no analytics or Sentry SDK, and nothing logs or stores the URL. Jest asserts the serialized navigation state holds no token, `token=`, `%23` or `#` param.                                                     |
| Token in custom-scheme URLs                                             | The app never emits one. An incoming `simplefit://invite/coach#…` is treated exactly like the https link (fragment dropped).                                                                                                                                       |
| Look-alike domains, ports, credentials, `http`                          | Exact match on `https:` + the configured host, no port, no userinfo. Anything else is not an invitation link (unit tests).                                                                                                                                         |
| Wrong account / account switch                                          | No state survives a sign-out (SF-28). User B's inbox lists only B's verified addresses, so A's invitation is never shown (verified natively).                                                                                                                      |
| Replay, expiry, cancellation, supersession                              | Opening a link performs no mutation. The inbox shows the backend's status, and acceptance is the SF-73 transaction (one relationship at most).                                                                                                                     |
| Duplicate or repeated link delivery                                     | Each delivery is a navigation to the same continuation. The entry's redirect replaces the stack, so there is no loop or duplicate screen (verified natively).                                                                                                      |
| Legal gate off                                                          | The inbox reports invitations unavailable, and nothing can be accepted (verified natively).                                                                                                                                                                        |
| OS-level retention                                                      | iOS keeps the launch URL in process memory (`Linking.getLinkingURL`, never read by app code). Android keeps the launch intent in the task record (redelivered from Recents, mapped the same way). Neither is app storage. This mirrors browser history on the web. |
| Email link rewriting (Outlook Safe Links, Gmail redirects)              | **Pre-existing SF-57 exposure, not changed here.** A rewriter may carry the whole URL, fragment included, in its own query string. A redirect through another domain also stops iOS from opening the app (the web page then opens). Not verified in SF-80.         |

## Configuration

| Where              | Variable                        | Effect                                                                                                                                                                                                                                 |
| ------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| simplefit-mobile   | `EXPO_PUBLIC_APP_LINK_HOST`     | `ios.associatedDomains = ["applinks:<host>"]` and one Android intent filter: `https`, `<host>`, path `/invite/coach`, `autoVerify`. The running app accepts links from that host. Unset: nothing is claimed. Needs a new native build. |
| simplefit-platform | `APP_LINKS_APPLE_TEAM_ID`       | Serves `/.well-known/apple-app-site-association`, which claims only `/invite/coach` for `<TeamID>.com.simplefit.boxing`. Unset: 404.                                                                                                   |
| simplefit-platform | `APP_LINKS_ANDROID_CERT_SHA256` | Serves `/.well-known/assetlinks.json` for `com.simplefit.boxing` with those fingerprints. Unset: 404.                                                                                                                                  |
| simplefit-api      | `WEB_APP_URL` (existing)        | Must be `https://<EXPO_PUBLIC_APP_LINK_HOST>`; the E08 links point there. No change.                                                                                                                                                   |

The association files are served with `content-type: application/json`, are
cacheable for an hour, require no authentication and are never redirected.
The locale proxy skips dotted paths.

## Remaining steps before links open the app (blocked on prerequisites)

1. **Domain:** choose and verify ownership of the production web domain, and
   a separate staging domain if wanted. Deploy simplefit-platform there over
   https and set the API's `WEB_APP_URL` to it.
2. **Apple:** the Apple Developer Team ID that signs `com.simplefit.boxing`.
   Enable Associated Domains for the App ID. So far only simulator builds
   exist, and they have no team signing.
3. **Android:** the SHA-256 fingerprints of every signing certificate: the
   EAS keystore (`eas credentials -p android`) and, once on Play, the
   **Play App Signing** key (Play Console → App integrity), not the upload key.
4. Set `APP_LINKS_*` on the web deployment and check both files with `curl -i`
   (200, `application/json`, no redirect). Use Apple's CDN check
   (`https://app-site-association.cdn-apple.com/a/v1/<host>`) and Google's
   Digital Asset Links API.
5. Build with `EXPO_PUBLIC_APP_LINK_HOST=<host>` (a new EAS build, which
   needs approval), then verify on devices:
   - iOS: link from Mail/Notes on a cold, warm and background app, and after
     an app upgrade;
   - Android: `adb shell pm get-app-links com.simplefit.boxing` shows
     `verified`, then cold and warm links;
   - both: no app installed → the web page (SF-60).

## Evidence (SF-80)

- **Jest:**
  - `features/coach-invitation-link` covers host and scheme allow-listing
    and fragment removal.
  - `shared/config/app-links.test.ts` covers the host rule and the native
    config.
  - `providers/router.test.tsx` routes `/invite/coach#token=…` through the
    real `src/app` tree for signed-out, fighter, onboarding-incomplete and
    registration-incomplete users, and checks that no token is in the
    navigation state. With the hook disabled, all five fail.
- **iOS simulator** (iPhone 16, iOS 18.5): the SF-70 development build, which
  has no Associated Domains entitlement, so only `simplefit://`. Real API on a
  disposable database, and the token taken from the real queued E08 email.
  Verified:
  - a cold link while signed out leads to sign-in, then to the inbox with the
    invitation still pending;
  - after an explicit accept there is exactly one relationship;
  - a warm or backgrounded, replayed, doubled link shows the inbox as
    Accepted, with no duplicate screen;
  - after an account switch, B's inbox is empty;
  - a user with no Fighter profile lands on Fighter onboarding;
  - with the gate off, invitations are unavailable;
  - no token appears in the API or Metro logs.
- **Not verified:** Universal Links and App Links association (no domain,
  Team ID, signed build or Android tooling), real email clients and link
  rewriters, and Android at all.
