import { withContinuation } from "@/shared/routes/continuation";
import { mobileGuards, routeHref } from "@/shared/routes/routes";

/*
 * Verified invitation links (SF-80; docs/invitation-app-links.md).
 *
 * The E08 email links to `https://<web app>/invite/coach#token=…` (SF-57).
 * Once that domain publishes its association files, iOS and Android may open
 * the link in this app instead of the browser. The app never uses the token:
 *
 * - The link is a navigation entry point, not an authorization grant. The
 *   fighter reaches the invitation through their own inbox (SF-73: the
 *   backend lists the invitations sent to their verified email identities),
 *   reviews the current disclosure and accepts or declines explicitly
 *   (SF-76). A Google- or Apple-only fighter verifies the invited address
 *   first (SF-79, "Missing an invitation?").
 * - So the fragment is dropped here, before Expo Router turns the URL into
 *   navigation state (it would keep `#token=…` as the route param `#`, and the
 *   session gate would carry it into `returnTo`). Nothing of it is kept,
 *   stored, logged or sent anywhere.
 *
 * Every system URL passes through `systemPathOf` (`src/app/+native-intent.tsx`)
 * on a cold start and on every later link. It is pure and never throws.
 */

/** The E08 link path (simplefit-api `Coaching.Invitations`), exactly. */
export const INVITATION_LINK_PATH = "/invite/coach";

/**
 * Where an invitation link leads: the sign-in route with the continuation the
 * web invitation page uses (`returnTo` the inbox, `intent` fighter). A
 * signed-out visitor signs in or up there; the gate sends a signed-in one on
 * to the entry, which resolves account and Fighter onboarding first (the
 * continuation rides along) and then opens the inbox.
 */
export const INVITATION_ENTRY = withContinuation(mobileGuards.signIn, {
  returnTo: routeHref("mobile.profile.coaches.invitations") as string,
  intent: "fighter",
}) as string;

const ROOT = "/";
const APP_SCHEME = "simplefit:";

/** `url` without its fragment, if any. */
const withoutFragment = (url: string) => {
  const hash = url.indexOf("#");
  return hash === -1 ? url : url.slice(0, hash);
};

/**
 * The in-app path for a URL the system delivered.
 *
 * - `https://<appLinkHost>/invite/coach` (any query, any fragment): the
 *   invitation entry. Any other path on that host: the entry `/` (the app
 *   claims only the invitation path, so none should arrive).
 * - `/invite/coach` without an origin: the same entry.
 * - `simplefit://invite/coach`: the same entry. The app scheme carries no
 *   authority and nothing ever sends a token through it; it routes the same
 *   way so the entry behaves identically whichever way the URL arrived.
 * - Anything else: unchanged, except that a fragment never survives.
 */
export function systemPathOf(path: string, appLinkHost: string | undefined): string {
  const bare = withoutFragment(path);
  let url: URL;
  try {
    url = new URL(bare);
  } catch {
    // A path without an origin (the form Expo Router's own location takes);
    // the app has no other screen at the invitation path.
    if (bare.split("?")[0] === INVITATION_LINK_PATH) return INVITATION_ENTRY;
    return bare === "" ? ROOT : bare;
  }

  if (url.protocol === "https:" || url.protocol === "http:") {
    if (appLinkHost === undefined || !isAppLinkOrigin(url, appLinkHost)) return bare;
    return url.pathname === INVITATION_LINK_PATH ? INVITATION_ENTRY : ROOT;
  }

  if (url.protocol === APP_SCHEME && url.host === "invite" && url.pathname === "/coach") {
    return INVITATION_ENTRY;
  }
  return bare;
}

/** Exactly `https://<appLinkHost>`: no other scheme, port or credentials. */
function isAppLinkOrigin(url: URL, appLinkHost: string): boolean {
  return (
    url.protocol === "https:" &&
    url.hostname === appLinkHost &&
    url.port === "" &&
    url.username === "" &&
    url.password === ""
  );
}
