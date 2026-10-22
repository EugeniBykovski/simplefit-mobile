/**
 * The host of verified invitation links (SF-80): the https origin the API's
 * `WEB_APP_URL` names, whose E08 links (`/invite/coach#token=…`) iOS and
 * Android may open in the app once the domain publishes its association
 * files. A bare DNS name, nothing else: no scheme, port, path, wildcard, IP
 * address or `localhost` (Universal Links and verified App Links need a real
 * https domain). Unset: the app claims no domain and every E08 link opens the
 * web page.
 *
 * Used by app.config.ts (the entitlement and intent filter) and by the
 * running app (which links it accepts), so both always name the same host.
 */
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export function parseAppLinkHost(value: string | undefined): string | undefined {
  const host = value?.trim().toLowerCase() ?? "";
  if (host === "") return undefined;
  const labels = host.split(".");
  const valid =
    host.length <= 253 &&
    labels.length >= 2 &&
    labels.every((label) => LABEL.test(label)) &&
    // A top-level label is never all digits: that is an IPv4 address.
    !/^\d+$/.test(labels.at(-1) ?? "");
  if (!valid) {
    throw new Error(
      "EXPO_PUBLIC_APP_LINK_HOST must be a domain name such as app.example.com (no scheme, port or path)",
    );
  }
  return host;
}
