import type { Formats } from "use-intl";

/**
 * Named, locale-independent format presets (same names as simplefit-platform).
 * The active locale decides how they render.
 *
 * Currency is deliberately NOT configured: it belongs to the business context
 * (gym, payment, user), never to the language. Always pass the code from data:
 *   format.number(price.amount, { style: "currency", currency: price.currency })
 */
export const formats = {
  dateTime: {
    date: { day: "numeric", month: "short", year: "numeric" },
    dateTime: {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
    time: { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" },
  },
  number: {
    integer: { maximumFractionDigits: 0 },
    decimal: { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    percent: { style: "percent", maximumFractionDigits: 1 },
  },
} satisfies Formats;
