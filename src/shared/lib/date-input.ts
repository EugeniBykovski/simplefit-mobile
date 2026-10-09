/*
 * Calendar dates typed as digits in the locale's day / month / year order
 * (SF-37 O04, SF-39 OF3): no native picker module. The typed text is masked
 * as the person types and read back as `YYYY-MM-DD` only when complete, so
 * no time zone can move the date. Validity is checked separately.
 */

type Part = "day" | "month" | "year";

/** The locale's numeric date order and separator, e.g. day.month.year for `de`. */
export function dateOrder(locale: string): { order: Part[]; separator: string } {
  const parts = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(2000, 10, 22));
  const order = parts
    .map((part) => part.type)
    .filter((type): type is Part => type === "day" || type === "month" || type === "year");
  const literal = parts.find((part) => part.type === "literal")?.value.trim() ?? "/";
  return {
    order: order.length === 3 ? order : ["day", "month", "year"],
    separator: literal === "" ? "/" : literal.charAt(0),
  };
}

const WIDTH: Record<Part, number> = { day: 2, month: 2, year: 4 };

/** The placeholder for the locale's order, e.g. "DD.MM.YYYY" (letters are translated by the caller). */
export function datePattern(locale: string, letters: Record<Part, string>): string {
  const { order, separator } = dateOrder(locale);
  return order.map((part) => letters[part].repeat(WIDTH[part])).join(separator);
}

/** Typed text reduced to digits and re-masked in the locale's order (at most 8 digits). */
export function maskDate(text: string, locale: string): string {
  const { order, separator } = dateOrder(locale);
  const digits = text.replace(/\D/g, "").slice(0, 8);
  const out: string[] = [];
  let at = 0;
  for (const part of order) {
    if (at >= digits.length) break;
    out.push(digits.slice(at, at + WIDTH[part]));
    at += WIDTH[part];
  }
  return out.join(separator);
}

/** A complete masked date as `YYYY-MM-DD`; "" while incomplete. Validity is checked separately. */
export function isoFromMasked(masked: string, locale: string): string {
  const { order } = dateOrder(locale);
  const digits = masked.replace(/\D/g, "");
  if (digits.length !== 8) return "";
  const value: Record<Part, string> = { day: "", month: "", year: "" };
  let at = 0;
  for (const part of order) {
    value[part] = digits.slice(at, at + WIDTH[part]);
    at += WIDTH[part];
  }
  return `${value.year}-${value.month}-${value.day}`;
}

/** A stored `YYYY-MM-DD` shown in the locale's masked order. */
export function maskedFromIso(iso: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const value: Record<Part, string> = {
    year: match[1] ?? "",
    month: match[2] ?? "",
    day: match[3] ?? "",
  };
  const { order, separator } = dateOrder(locale);
  return order.map((part) => value[part]).join(separator);
}
