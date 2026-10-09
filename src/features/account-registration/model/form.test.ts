import { ApiError } from "@/shared/api/http/api-error";

import {
  clientErrors,
  dateOrder,
  isAtLeast16,
  isCalendarDate,
  isoFromMasked,
  maskDate,
  maskedFromIso,
  patchFrom,
  rejectionOf,
  todayIso,
  valuesFrom,
  type AccountValues,
} from "./form";

const VALUES: AccountValues = {
  full_name: "Alex Kowalski",
  date_of_birth: "2000-05-17",
  accept_terms: true,
  accept_privacy: true,
  product_news: false,
};

describe("valuesFrom", () => {
  it("ticks a required consent only for the version in force", () => {
    const consent = (current: boolean) => ({
      accepted: true,
      accepted_version: "v1",
      accepted_at: "2026-10-01T00:00:00Z",
      current_version: current ? "v1" : "v2",
      current,
    });
    const values = valuesFrom({
      registration: { status: "in_progress", completed_at: null, missing_requirements: [] },
      full_name: null,
      date_of_birth: null,
      consents: { terms: consent(true), privacy: consent(false) },
      product_news: { subscribed: true, updated_at: null },
    });
    expect(values).toEqual({
      full_name: "",
      date_of_birth: "",
      accept_terms: true,
      accept_privacy: false,
      product_news: true,
    });
  });
});

describe("dates", () => {
  it("knows real calendar dates and 16th birthdays, by calendar only", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2023-02-29")).toBe(false);
    expect(isCalendarDate("2000-13-01")).toBe(false);
    expect(isAtLeast16("2010-10-09", "2026-10-09")).toBe(true);
    expect(isAtLeast16("2010-10-10", "2026-10-09")).toBe(false);
    expect(todayIso(new Date(2026, 0, 2, 23, 59))).toBe("2026-01-02");
  });

  it("orders the typed date by locale and never shifts it", () => {
    expect(dateOrder("de").order).toEqual(["day", "month", "year"]);
    expect(dateOrder("en-US").order).toEqual(["month", "day", "year"]);
    expect(maskDate("17052000", "de")).toBe("17.05.2000");
    expect(maskDate("1705", "de")).toBe("17.05");
    expect(maskDate("05172000999", "en-US")).toBe("05/17/2000");
    expect(isoFromMasked("17.05.2000", "de")).toBe("2000-05-17");
    expect(isoFromMasked("05/17/2000", "en-US")).toBe("2000-05-17");
    expect(isoFromMasked("17.05.20", "de")).toBe("");
    expect(maskedFromIso("2000-05-17", "pl")).toBe(maskDate("17052000", "pl"));
  });
});

describe("clientErrors", () => {
  it("lists every missing requirement the API would", () => {
    expect(clientErrors(VALUES, "17.05.2000", "2026-10-09")).toEqual({});
    expect(
      clientErrors(
        {
          ...VALUES,
          full_name: " ",
          accept_terms: false,
          accept_privacy: false,
          date_of_birth: "",
        },
        "",
        "2026-10-09",
      ),
    ).toEqual({
      full_name: "fullNameRequired",
      date_of_birth: "dateOfBirthRequired",
      accept_terms: "terms",
      accept_privacy: "privacy",
    });
  });

  it("tells an incomplete, impossible, future and too-young date apart", () => {
    const at = (date_of_birth: string, text: string) =>
      clientErrors({ ...VALUES, date_of_birth }, text, "2026-10-09").date_of_birth;
    expect(at("", "17.05")).toBe("invalidDate");
    expect(at("2023-02-29", "29.02.2023")).toBe("invalidDate");
    expect(at("2027-01-01", "01.01.2027")).toBe("invalidDate");
    expect(at("2012-01-01", "01.01.2012")).toBe("tooYoung");
  });
});

describe("patchFrom", () => {
  it("sends only what the person changed, consents only as an explicit true", () => {
    expect(patchFrom(VALUES, {}, {})).toEqual({});
    expect(
      patchFrom(
        VALUES,
        { full_name: true, date_of_birth: true, accept_terms: true, product_news: true },
        {},
      ),
    ).toEqual({
      full_name: "Alex Kowalski",
      date_of_birth: "2000-05-17",
      accept_terms: true,
      product_news: false,
    });
    expect(patchFrom({ ...VALUES, accept_privacy: false }, { accept_privacy: true }, {})).toEqual(
      {},
    );
  });

  it("leaves out a field that failed the checks", () => {
    expect(
      patchFrom(VALUES, { full_name: true, date_of_birth: true }, { date_of_birth: "tooYoung" }),
    ).toEqual({ full_name: "Alex Kowalski" });
  });
});

describe("rejectionOf", () => {
  it("maps the API's field codes onto the controls", () => {
    const error = ApiError.fromResponse(
      422,
      {
        error: {
          code: "validation_error",
          message: "x",
          details: {
            field_codes: {
              date_of_birth: ["too_young"],
              terms: ["required"],
              full_name: ["required"],
            },
          },
        },
      },
      null,
    );
    expect(rejectionOf(error)).toEqual({
      date_of_birth: "tooYoung",
      accept_terms: "terms",
      full_name: "fullNameRequired",
    });
    expect(rejectionOf(ApiError.network(new Error("offline")))).toBeUndefined();
  });
});
