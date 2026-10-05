import { createFormatter } from "use-intl";

import { formats } from "./formats";
import { locales, type Locale } from "./locales";

const formatter = (locale: Locale, timeZone = "UTC") =>
  createFormatter({ locale, formats, timeZone });
const plain = (value: string) => value.replace(/[  ]/g, " ");
const moment = Date.UTC(2026, 9, 5, 14, 5, 9);

// Representative output (Node ICU); identical expectations to simplefit-platform.
const expected: Record<
  Locale,
  { decimal: string; percent: string; date: string; eur: string; mxn: string }
> = {
  en: {
    decimal: "1,234,567.89",
    percent: "25.6%",
    date: "Oct 5, 2026",
    eur: "€1,234.50",
    mxn: "MX$1,234.50",
  },
  ru: {
    decimal: "1 234 567,89",
    percent: "25,6 %",
    date: "5 окт. 2026 г.",
    eur: "1 234,50 €",
    mxn: "1 234,50 MX$",
  },
  pl: {
    decimal: "1 234 567,89",
    percent: "25,6%",
    date: "5 paź 2026",
    eur: "1234,50 €",
    mxn: "1234,50 MXN",
  },
  de: {
    decimal: "1.234.567,89",
    percent: "25,6 %",
    date: "5. Okt. 2026",
    eur: "1.234,50 €",
    mxn: "1.234,50 MX$",
  },
  uk: {
    decimal: "1 234 567,89",
    percent: "25,6%",
    date: "5 жовт. 2026 р.",
    eur: "1 234,50 EUR",
    mxn: "1 234,50 MXN",
  },
  es: {
    decimal: "1.234.567,89",
    percent: "25,6 %",
    date: "5 oct 2026",
    eur: "1234,50 €",
    mxn: "1234,50 MXN",
  },
  "es-MX": {
    decimal: "1,234,567.89",
    percent: "25.6%",
    date: "5 oct 2026",
    eur: "EUR 1,234.50",
    mxn: "$1,234.50",
  },
  fr: {
    decimal: "1 234 567,89",
    percent: "25,6 %",
    date: "5 oct. 2026",
    eur: "1 234,50 €",
    mxn: "1 234,50 $MX",
  },
};

describe.each(locales)("formatting: %s", (locale) => {
  const format = formatter(locale);
  const want = expected[locale];

  it("formats numbers, percentages and dates per locale", () => {
    expect(plain(format.number(1234567.891, "decimal"))).toBe(want.decimal);
    expect(plain(format.number(0.256, "percent"))).toBe(want.percent);
    expect(plain(format.dateTime(moment, "date"))).toBe(want.date);
  });

  it("formats currency only with an explicitly supplied code", () => {
    expect(plain(format.number(1234.5, { style: "currency", currency: "EUR" }))).toBe(want.eur);
    expect(plain(format.number(1234.5, { style: "currency", currency: "MXN" }))).toBe(want.mxn);
  });
});

describe("locale, time zone and currency are independent", () => {
  it("renders the same locale in different time zones", () => {
    expect(plain(formatter("ru", "Europe/Warsaw").dateTime(moment, "time"))).toBe("16:05:09 GMT+2");
    expect(plain(formatter("ru", "UTC").dateTime(moment, "time"))).toBe("14:05:09 UTC");
  });

  it("keeps Spanish and Mexican Spanish formatting distinct", () => {
    expect(expected.es.decimal).not.toBe(expected["es-MX"].decimal);
  });

  it("configures no default currency", () => {
    expect(JSON.stringify(formats)).not.toMatch(/currency/i);
  });
});
