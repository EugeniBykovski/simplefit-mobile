import { GYM_INVITATION_ENTRY, INVITATION_ENTRY, systemPathOf } from "./system-path";

const HOST = "app.example.com";
const TOKEN = "sfi_c2VjcmV0LWludml0YXRpb24tdG9rZW4";

describe("invitation links (SF-80)", () => {
  it("leads to sign-in with the inbox continuation, never to the token", () => {
    expect(INVITATION_ENTRY).toBe(
      "/login?returnTo=%2Fprofile%2Fcoaches%2Finvitations&intent=fighter",
    );
    for (const url of [
      `https://${HOST}/invite/coach#token=${TOKEN}`,
      `https://${HOST}/invite/coach`,
      // Tracking parameters an email client or scanner may add are ignored.
      `https://${HOST}/invite/coach?utm_source=email#token=${TOKEN}`,
      `HTTPS://APP.EXAMPLE.COM/invite/coach#token=${TOKEN}`,
      `simplefit://invite/coach#token=${TOKEN}`,
      `/invite/coach#token=${TOKEN}`,
    ]) {
      expect(systemPathOf(url, HOST)).toBe(INVITATION_ENTRY);
    }
  });

  it("claims only the exact invitation path on the exact https origin", () => {
    // Other paths of the claimed host: the neutral entry.
    for (const path of ["/invite/coach/", "/Invite/Coach", "/invite/coach/x", "/en/invite/coach"]) {
      expect(systemPathOf(`https://${HOST}${path}#token=${TOKEN}`, HOST)).toBe("/");
    }
    // Look-alike or unexpected origins are never invitation links.
    for (const url of [
      `http://${HOST}/invite/coach#token=${TOKEN}`,
      `https://${HOST}:8443/invite/coach#token=${TOKEN}`,
      `https://user@${HOST}/invite/coach#token=${TOKEN}`,
      `https://${HOST}.evil.test/invite/coach#token=${TOKEN}`,
      `https://evil-${HOST}/invite/coach#token=${TOKEN}`,
      `https://evil.test/invite/coach#token=${TOKEN}`,
      `https://${HOST}@evil.test/invite/coach#token=${TOKEN}`,
      `simplefit://invite/coach/extra#token=${TOKEN}`,
      `othersimplefit://invite/coach#token=${TOKEN}`,
    ]) {
      expect(systemPathOf(url, HOST)).not.toBe(INVITATION_ENTRY);
    }
  });

  it("claims no domain without a configured host", () => {
    expect(systemPathOf(`https://${HOST}/invite/coach#token=${TOKEN}`, undefined)).toBe(
      `https://${HOST}/invite/coach`,
    );
  });

  it("never lets a fragment through, whatever the URL", () => {
    for (const url of [
      `https://${HOST}/invite/coach#token=${TOKEN}`,
      `https://${HOST}/anything#token=${TOKEN}`,
      `https://elsewhere.test/page#token=${TOKEN}`,
      `simplefit://settings#token=${TOKEN}`,
      `simplefit:///#token=${TOKEN}`,
      `/profile#token=${TOKEN}`,
      `#token=${TOKEN}`,
      `not a url #token=${TOKEN}`,
      `exp+simplefit-boxing://expo-development-client/?url=x#token=${TOKEN}`,
    ]) {
      const path = systemPathOf(url, HOST);
      expect(path).not.toContain("#");
      expect(path).not.toContain(TOKEN);
      expect(path).not.toContain("token");
    }
  });

  it("leaves every other URL as it was", () => {
    expect(systemPathOf("simplefit:///", HOST)).toBe("simplefit:///");
    expect(systemPathOf("simplefit://settings", HOST)).toBe("simplefit://settings");
    expect(systemPathOf("/profile/coaches/invitations", HOST)).toBe("/profile/coaches/invitations");
    expect(systemPathOf("", HOST)).toBe("/");
  });
});

describe("the E07 member invitation link (SF-135)", () => {
  const TOKEN = `sgm_${"a".repeat(43)}`;

  it("leads to the member's own inbox, with no intent and no token", () => {
    expect(GYM_INVITATION_ENTRY).toBe("/login?returnTo=%2Fme%2Fgyms%2Finvitations");
    expect(GYM_INVITATION_ENTRY).not.toContain("intent");
  });

  it.each([
    `https://${HOST}/invite/gym#token=${TOKEN}`,
    `https://${HOST}/invite/gym?utm=x#token=${TOKEN}`,
    `https://${HOST}/invite/gym`,
    `simplefit://invite/gym#token=${TOKEN}`,
    "simplefit://invite/gym",
    `/invite/gym#token=${TOKEN}`,
    "/invite/gym",
  ])("%s", (url) => {
    const path = systemPathOf(url, HOST);
    expect(path).toBe(GYM_INVITATION_ENTRY);
    expect(path).not.toContain(TOKEN);
  });

  it("a look-alike origin never reaches the entry, and never keeps the fragment", () => {
    for (const url of [
      `https://evil.example/invite/gym#token=${TOKEN}`,
      `http://${HOST}/invite/gym#token=${TOKEN}`,
      `https://${HOST}:8443/invite/gym#token=${TOKEN}`,
      `https://user:pass@${HOST}/invite/gym#token=${TOKEN}`,
    ]) {
      const path = systemPathOf(url, HOST);
      expect(path).not.toBe(GYM_INVITATION_ENTRY);
      expect(path).not.toContain(TOKEN);
    }
  });

  it("nearby paths are not the invitation", () => {
    expect(systemPathOf(`https://${HOST}/invite/gymnasium`, HOST)).toBe("/");
    expect(systemPathOf("simplefit://invite/gym/extra", HOST)).toBe("simplefit://invite/gym/extra");
    expect(systemPathOf(`https://${HOST}/invite/staff#token=x`, HOST)).toBe("/");
  });

  it("without a configured host an https link stays unclaimed, minus the fragment", () => {
    expect(systemPathOf(`https://${HOST}/invite/gym#token=${TOKEN}`, undefined)).toBe(
      `https://${HOST}/invite/gym`,
    );
  });
});
