import { TIME_ZONES } from "./time-zones.data";

/*
 * Wall times in an IANA time zone, with the device's own zone data (Intl):
 * no time-zone library (SF-65; the same rules as the web planner, SF-64). A
 * wall time ("2027-03-28", "02:30" in Europe/Warsaw) is either one instant,
 * no instant (clocks jump over it) or two (clocks go back and repeat it).
 * The backend accepts an RFC 3339 instant whose non-UTC offset is the zone's
 * at that instant (SF-62), so a time that does not exist is never sent and a
 * repeated one only with the offset the coach chose. The offset is always
 * the zone's at the planned instant, never today's or the device's.
 */

const MINUTE = 60_000;

const partsFormat = new Map<string, Intl.DateTimeFormat>();

/** A cached `en-US` formatter that prints every field of an instant in `zone`, 24-hour. */
function formatIn(zone: string): Intl.DateTimeFormat {
  let format = partsFormat.get(zone);
  if (format === undefined) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormat.set(zone, format);
  }
  return format;
}

/** The fields of `instant` on the wall clock of `zone`. */
function wallFields(instant: Date, zone: string) {
  const fields: Record<string, number> = {};
  for (const part of formatIn(zone).formatToParts(instant)) {
    if (part.type !== "literal") fields[part.type] = Number(part.value);
  }
  return {
    year: fields.year ?? 0,
    month: fields.month ?? 1,
    day: fields.day ?? 1,
    // Some engines print midnight as 24 even with `h23`.
    hour: (fields.hour ?? 0) % 24,
    minute: fields.minute ?? 0,
    second: fields.second ?? 0,
  };
}

/** Whether `zone` is a time zone this device knows. */
export function isKnownTimeZone(zone: string): boolean {
  if (partsFormat.has(zone)) return true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** The UTC offset of `zone` at `instant`, in minutes east of UTC (Warsaw in summer: 120). */
export function zoneOffsetMinutes(zone: string, instant: Date): number {
  const wall = wallFields(instant, zone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const whole = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asUtc - whole) / MINUTE);
}

/** `+02:00`, `-03:30`, `+00:00`. */
export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

/** One way a wall time happens: the instant and the zone's offset then. */
export type WallInstant = { instant: Date; offsetMinutes: number };

export type WallTimeResolution =
  | { kind: "exact"; at: WallInstant }
  /** Clocks jump over this wall time on that day: it never happens. */
  | { kind: "gap" }
  /** Clocks go back over it: it happens twice, earliest first. */
  | { kind: "overlap"; first: WallInstant; second: WallInstant }
  /** Not a date (`YYYY-MM-DD`) and a time (`HH:MM`), or an unknown zone. */
  | { kind: "invalid" };

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{2}):(\d{2})$/;

/**
 * The instants at which the wall clock of `zone` shows `date` `time`. Every
 * offset the zone uses within a day of it is tried; an offset is right when
 * the zone has that offset at the instant it gives.
 */
export function resolveWallTime(date: string, time: string, zone: string): WallTimeResolution {
  const d = DATE.exec(date);
  const t = TIME.exec(time);
  if (d === null || t === null || !isKnownTimeZone(zone)) return { kind: "invalid" };
  const [year, month, day, hour, minute] = [d[1], d[2], d[3], t[1], t[2]].map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wall);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return { kind: "invalid" };
  }

  const offsets = new Set(
    [-1, 0, 1].map((days) => zoneOffsetMinutes(zone, new Date(wall + days * 24 * 60 * MINUTE))),
  );
  const found = [...offsets]
    .map((offsetMinutes) => ({ instant: new Date(wall - offsetMinutes * MINUTE), offsetMinutes }))
    .filter((candidate) => zoneOffsetMinutes(zone, candidate.instant) === candidate.offsetMinutes)
    .sort((a, b) => a.instant.getTime() - b.instant.getTime());

  const [first, second] = found;
  if (first === undefined) return { kind: "gap" };
  if (second === undefined) return { kind: "exact", at: first };
  return { kind: "overlap", first, second };
}

/** `2026-10-21T18:00:00+02:00`: the instant as RFC 3339 with the zone's offset at it. */
export function toRfc3339(at: WallInstant): string {
  const wall = new Date(at.instant.getTime() + at.offsetMinutes * MINUTE);
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}` +
    `T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:${pad(wall.getUTCSeconds())}` +
    formatOffset(at.offsetMinutes)
  );
}

/** The wall date (`YYYY-MM-DD`) and time (`HH:MM`) of `instant` in `zone`. */
export function wallTimeOf(instant: Date, zone: string): { date: string; time: string } {
  const wall = wallFields(instant, zone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    date: `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`,
    time: `${pad(wall.hour)}:${pad(wall.minute)}`,
  };
}

/*
 * The native pickers show a wall date and time, not an instant: they run in
 * UTC (`timeZoneName="UTC"`), so the picked Date's UTC fields are exactly the
 * date and time the coach chose, whatever the device's zone or its
 * daylight-saving changes. The zone of the session is applied afterwards.
 */

/** The picker value showing `date` (`YYYY-MM-DD`) `time` (`HH:MM`). */
export function pickerValue(date: string, time: string): Date {
  const d = DATE.exec(date);
  const t = TIME.exec(time);
  if (d === null || t === null) return new Date(Date.UTC(2000, 0, 1));
  return new Date(
    Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2])),
  );
}

/** The wall date and time a picker (in UTC) shows. */
export function fromPickerValue(value: Date): { date: string; time: string } {
  return wallTimeOf(value, "UTC");
}

/** A region zone (`Europe/Warsaw`) or `UTC`: what the backend accepts (SF-49 §8.3). */
function selectableZone(zone: string): boolean {
  return zone === "UTC" || (/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+$/.test(zone) && !/^Etc\//.test(zone));
}

/**
 * The device's time zone as the default for planning (`UTC` for the `Etc/`
 * UTC aliases); `null` when it reports none or one the backend does not take.
 */
export function plannableZone(zone: string | undefined | null): string | null {
  if (!zone) return null;
  if (zone === "Etc/UTC" || zone === "Etc/GMT" || zone === "GMT") return "UTC";
  return selectableZone(zone) && isKnownTimeZone(zone) ? zone : null;
}

let known: string[] | undefined;

/**
 * The zones a coach can choose from: the bundled IANA list (region zones and
 * UTC) that this device's zone data knows, with `include` added when it is
 * listed under another name (an existing session's zone stays selectable).
 */
export function selectableTimeZones(include: readonly string[] = []): string[] {
  known ??= TIME_ZONES.filter(isKnownTimeZone);
  const zones = new Set(known);
  for (const zone of include) if (zone) zones.add(zone);
  return [...zones].sort((a, b) => (a === "UTC" ? -1 : b === "UTC" ? 1 : a.localeCompare(b)));
}
