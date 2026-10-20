import {
  formatOffset,
  fromPickerValue,
  isKnownTimeZone,
  pickerValue,
  plannableZone,
  resolveWallTime,
  selectableTimeZones,
  toRfc3339,
  wallTimeOf,
  zoneOffsetMinutes,
} from "./time-zone";
import { TIME_ZONES } from "./time-zones.data";

describe("zoneOffsetMinutes", () => {
  it("reads the zone's offset at an instant, across daylight saving", () => {
    expect(zoneOffsetMinutes("Europe/Warsaw", new Date("2026-07-01T12:00:00Z"))).toBe(120);
    expect(zoneOffsetMinutes("Europe/Warsaw", new Date("2026-12-01T12:00:00Z"))).toBe(60);
    expect(zoneOffsetMinutes("America/New_York", new Date("2026-12-01T12:00:00Z"))).toBe(-300);
    expect(zoneOffsetMinutes("Asia/Kolkata", new Date("2026-12-01T12:00:00Z"))).toBe(330);
    expect(zoneOffsetMinutes("UTC", new Date("2026-12-01T12:00:00Z"))).toBe(0);
  });
});

describe("resolveWallTime", () => {
  it("resolves an ordinary Warsaw wall time to one instant with that day's offset", () => {
    const summer = resolveWallTime("2026-10-21", "18:00", "Europe/Warsaw");
    expect(summer.kind === "exact" && toRfc3339(summer.at)).toBe("2026-10-21T18:00:00+02:00");
    // A future date in winter gets the winter offset, not today's.
    const winter = resolveWallTime("2026-12-03", "18:00", "Europe/Warsaw");
    expect(winter.kind === "exact" && toRfc3339(winter.at)).toBe("2026-12-03T18:00:00+01:00");
    expect(winter.kind === "exact" && winter.at.instant.toISOString()).toBe(
      "2026-12-03T17:00:00.000Z",
    );
  });

  it("refuses a wall time the clocks jump over (Warsaw spring forward)", () => {
    expect(resolveWallTime("2027-03-28", "02:30", "Europe/Warsaw")).toEqual({ kind: "gap" });
    expect(resolveWallTime("2027-03-14", "02:15", "America/New_York")).toEqual({ kind: "gap" });
  });

  it("offers both instants of a repeated wall time (Warsaw fall back), earliest first", () => {
    const result = resolveWallTime("2026-10-25", "02:30", "Europe/Warsaw");
    expect(result.kind).toBe("overlap");
    if (result.kind !== "overlap") return;
    expect(toRfc3339(result.first)).toBe("2026-10-25T02:30:00+02:00");
    expect(toRfc3339(result.second)).toBe("2026-10-25T02:30:00+01:00");
    expect(result.first.instant.toISOString()).toBe("2026-10-25T00:30:00.000Z");
    expect(result.second.instant.toISOString()).toBe("2026-10-25T01:30:00.000Z");
  });

  it("keeps the edges of a transition exact", () => {
    expect(resolveWallTime("2027-03-28", "03:00", "Europe/Warsaw").kind).toBe("exact");
    expect(resolveWallTime("2027-03-28", "01:59", "Europe/Warsaw").kind).toBe("exact");
    expect(resolveWallTime("2026-10-25", "03:00", "Europe/Warsaw").kind).toBe("exact");
  });

  it("handles another zone, fractional and southern-hemisphere offsets", () => {
    const lisbon = resolveWallTime("2026-11-02", "19:00", "Europe/Lisbon");
    expect(lisbon.kind === "exact" && toRfc3339(lisbon.at)).toBe("2026-11-02T19:00:00+00:00");
    const kolkata = resolveWallTime("2026-12-01", "09:00", "Asia/Kolkata");
    expect(kolkata.kind === "exact" && toRfc3339(kolkata.at)).toBe("2026-12-01T09:00:00+05:30");
    expect(resolveWallTime("2026-10-04", "02:30", "Australia/Sydney")).toEqual({ kind: "gap" });
  });

  it("crosses UTC midnight without moving the planned day", () => {
    // 23:30 in New York is 04:30 UTC the next day; the wall date stays the 20th.
    const late = resolveWallTime("2026-11-20", "23:30", "America/New_York");
    expect(late.kind === "exact" && toRfc3339(late.at)).toBe("2026-11-20T23:30:00-05:00");
    expect(late.kind === "exact" && late.at.instant.toISOString()).toBe("2026-11-21T04:30:00.000Z");
    // 00:30 in Tokyo is the previous day in UTC.
    const early = resolveWallTime("2026-11-21", "00:30", "Asia/Tokyo");
    expect(early.kind === "exact" && early.at.instant.toISOString()).toBe(
      "2026-11-20T15:30:00.000Z",
    );
  });

  it("gives a different instant when the zone changes after the wall time was entered", () => {
    const warsaw = resolveWallTime("2026-11-02", "19:00", "Europe/Warsaw");
    const newYork = resolveWallTime("2026-11-02", "19:00", "America/New_York");
    expect(warsaw.kind === "exact" && toRfc3339(warsaw.at)).toBe("2026-11-02T19:00:00+01:00");
    expect(newYork.kind === "exact" && toRfc3339(newYork.at)).toBe("2026-11-02T19:00:00-05:00");
  });

  it("formats UTC with a zero offset", () => {
    const result = resolveWallTime("2026-12-01", "07:05", "UTC");
    expect(result.kind === "exact" && toRfc3339(result.at)).toBe("2026-12-01T07:05:00+00:00");
  });

  it("rejects malformed dates, times and unknown zones", () => {
    expect(resolveWallTime("2026-02-30", "10:00", "UTC")).toEqual({ kind: "invalid" });
    expect(resolveWallTime("2026-02-10", "24:00", "UTC")).toEqual({ kind: "invalid" });
    expect(resolveWallTime("", "10:00", "UTC")).toEqual({ kind: "invalid" });
    expect(resolveWallTime("2026-02-10", "10:00", "Mars/Olympus")).toEqual({ kind: "invalid" });
  });
});

describe("wallTimeOf", () => {
  it("reads a stored UTC instant back on the session zone's wall clock (edit)", () => {
    expect(wallTimeOf(new Date("2026-10-21T16:00:00Z"), "Europe/Warsaw")).toEqual({
      date: "2026-10-21",
      time: "18:00",
    });
    expect(wallTimeOf(new Date("2026-10-21T02:00:00Z"), "America/Los_Angeles")).toEqual({
      date: "2026-10-20",
      time: "19:00",
    });
    // The second 02:30 of the Warsaw fall-back reads back as 02:30.
    expect(wallTimeOf(new Date("2026-10-25T01:30:00Z"), "Europe/Warsaw")).toEqual({
      date: "2026-10-25",
      time: "02:30",
    });
  });
});

describe("the native picker in UTC", () => {
  it("shows exactly the wall date and time, whatever the device's zone", () => {
    const value = pickerValue("2027-03-28", "02:30");
    expect(value.toISOString()).toBe("2027-03-28T02:30:00.000Z");
    expect(fromPickerValue(value)).toEqual({ date: "2027-03-28", time: "02:30" });
    expect(fromPickerValue(new Date("2026-10-25T23:59:00Z"))).toEqual({
      date: "2026-10-25",
      time: "23:59",
    });
  });
});

describe("formatOffset and zones", () => {
  it("prints signed hour:minute offsets", () => {
    expect(formatOffset(120)).toBe("+02:00");
    expect(formatOffset(-210)).toBe("-03:30");
    expect(formatOffset(0)).toBe("+00:00");
  });

  it("lists UTC first and only region zones the device knows, keeping an included one", () => {
    const zones = selectableTimeZones(["Europe/Kiev"]);
    expect(zones[0]).toBe("UTC");
    expect(zones).toContain("Europe/Warsaw");
    expect(zones).toContain("Europe/Kiev");
    expect(zones.some((zone) => zone.startsWith("Etc/"))).toBe(false);
    expect(TIME_ZONES.every(isKnownTimeZone)).toBe(true);
    expect(isKnownTimeZone("Nope/Nowhere")).toBe(false);
  });

  it("defaults to the device's zone only when the backend takes it", () => {
    expect(plannableZone("Europe/Warsaw")).toBe("Europe/Warsaw");
    expect(plannableZone("Etc/UTC")).toBe("UTC");
    expect(plannableZone("Etc/GMT+3")).toBeNull();
    expect(plannableZone(undefined)).toBeNull();
  });
});
