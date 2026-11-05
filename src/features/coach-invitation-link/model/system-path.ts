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
 * The E07 member invitation (`/invite/gym#token=…`, SF-95) works the same way
 * (SF-135): it leads to the member's own inbox, with no intent, since joining a
 * gym needs no Fighter profile; the token is dropped with the fragment.
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

/** The E07 link path (simplefit-api `Gyms.MemberInvitations`), exactly. */
export const GYM_INVITATION_LINK_PATH = "/invite/gym";

/** Where an E07 link leads: sign-in, then the entry, then the member's inbox. */
export const GYM_INVITATION_ENTRY = withContinuation(mobileGuards.signIn, {
  returnTo: routeHref("mobile.me.gyms.invitations") as string,
}) as string;

/** The entry of a claimed invitation path, if `path` is exactly one. */
function entryOf(path: string): string | undefined {
  if (path === INVITATION_LINK_PATH) return INVITATION_ENTRY;
  if (path === GYM_INVITATION_LINK_PATH) return GYM_INVITATION_ENTRY;
  return undefined;
}

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
 * - `https://<appLinkHost>/invite/coach` or `/invite/gym` (any query, any
 *   fragment): that invitation's entry. Any other path on that host: the entry
 *   `/` (the app claims only the invitation paths, so none should arrive).
 * - The same paths without an origin: the same entries.
 * - `simplefit://invite/coach` and `simplefit://invite/gym`: the same entries. The
 *   app scheme carries no authority and nothing ever sends a token through it; it
 *   routes the same way so an entry behaves identically whichever way it arrived.
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
    return entryOf(bare.split("?")[0] ?? "") ?? (bare === "" ? ROOT : bare);
  }

  if (url.protocol === "https:" || url.protocol === "http:") {
    if (appLinkHost === undefined || !isAppLinkOrigin(url, appLinkHost)) return bare;
    return entryOf(url.pathname) ?? ROOT;
  }

  if (url.protocol === APP_SCHEME && url.host === "invite") {
    return entryOf(`/invite${url.pathname}`) ?? bare;
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
