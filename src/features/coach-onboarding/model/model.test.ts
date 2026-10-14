import type { CoachProfile } from "@/entities/coach-profile";
import { ApiError } from "@/shared/api/http/api-error";

import {
  COACHING_FORMATS,
  COMPETITION_LEVELS,
  LANGUAGES,
  lengthOf,
  nameSuggestion,
  rejectionOf,
  stepErrors,
  stepPatch,
  toggled,
  valuesFrom,
} from "./form";
import { decideStep, resumeStep } from "./steps";

function coach(fields: Partial<CoachProfile> = {}, status = "in_progress"): CoachProfile {
  const merged = {
    display_name: null,
    brand_name: null,
    country_code: null,
    city: null,
    bio: null,
    languages: [],
    coaching_formats: [],
    competition_levels: [],
    ...fields,
  } as Omit<CoachProfile, "onboarding">;
  const missing = [
    ...(["display_name", "country_code", "city"] as const).filter((key) => merged[key] === null),
    ...(merged.coaching_formats.length === 0 ? (["coaching_formats"] as const) : []),
  ];
  return {
    ...merged,
    onboarding: {
      status: status as CoachProfile["onboarding"]["status"],
      completed_at: status === "completed" ? "2026-10-14T10:00:00Z" : null,
      missing_requirements: status === "completed" ? [] : missing,
    },
  };
}

const PROFILE = { display_name: "Coach Sam", country_code: "PL", city: "Kraków" };

describe("Coach steps (OC1, OC2, OC11)", () => {
  it("resumes at OC1 while a coach-profile requirement is missing, then at OC2", () => {
    expect(resumeStep(coach({}, "not_started"))).toBe("profile");
    expect(resumeStep(coach({ display_name: "Sam" }))).toBe("profile");
    expect(resumeStep(coach(PROFILE))).toBe("type");
    // Every requirement met but not completed: Finish on OC2 is the only way on.
    expect(resumeStep(coach({ ...PROFILE, coaching_formats: ["fight_camps"] }))).toBe("type");
  });

  it("opens a requested form step and resolves anything else to the resume step", () => {
    const partial = coach(PROFILE);
    expect(decideStep(partial, "profile", false)).toEqual({ kind: "step", step: "profile" });
    expect(decideStep(partial, "type", false)).toEqual({ kind: "step", step: "type" });
    for (const requested of ["complete", "credentials", "size", "gym", "plan", "x", undefined, 3])
      expect(decideStep(partial, requested, false)).toEqual({ kind: "step", step: "type" });
  });

  it("shows OC11 only right after this screen completed; otherwise a completed profile exits", () => {
    const completed = coach({ ...PROFILE, coaching_formats: ["fight_camps"] }, "completed");
    expect(decideStep(completed, "complete", false)).toEqual({ kind: "exit" });
    expect(decideStep(completed, "profile", false)).toEqual({ kind: "exit" });
    expect(decideStep(completed, undefined, true)).toEqual({ kind: "step", step: "complete" });
    // Never OC11 for an unfinished profile, even if this screen thinks it completed.
    expect(decideStep(coach(PROFILE), "complete", true)).toEqual({ kind: "step", step: "type" });
  });
});

describe("Coach form", () => {
  it("uses the generated SF-50 vocabularies in contract order, with no mobile-only values", () => {
    expect(COACHING_FORMATS).toEqual([
      "personal_training",
      "group_coaching",
      "online_coaching",
      "fight_camps",
    ]);
    expect(COMPETITION_LEVELS).toEqual(["amateur", "professional"]);
    expect(LANGUAGES).toEqual(["en", "pl", "ru", "be", "uk"]);
  });

  it("toggles a multi-select value in contract order, never repeating one", () => {
    expect(toggled(LANGUAGES, ["uk"], "pl")).toEqual(["pl", "uk"]);
    expect(toggled(LANGUAGES, ["pl", "uk"], "pl")).toEqual(["uk"]);
    expect(toggled(COACHING_FORMATS, ["fight_camps", "fight_camps"], "group_coaching")).toEqual([
      "group_coaching",
      "fight_camps",
    ]);
  });

  it("counts characters as the API does: code points after trimming", () => {
    expect(lengthOf("  Sam  ")).toBe(3);
    expect(lengthOf("🥊🥊")).toBe(2);
    const values = valuesFrom(coach(PROFILE));
    expect(stepErrors("profile", { ...values, display_name: "🥊".repeat(60) })).toEqual({});
    expect(stepErrors("profile", { ...values, display_name: "x".repeat(61) })).toEqual({
      display_name: "tooLong",
    });
    expect(stepErrors("profile", { ...values, bio: "b".repeat(501) })).toEqual({ bio: "tooLong" });
  });

  it("checks each step's completion requirements", () => {
    const empty = valuesFrom(coach({}, "not_started"));
    expect(stepErrors("profile", empty)).toEqual({
      display_name: "required.display_name",
      country_code: "required.country_code",
      city: "required.city",
    });
    expect(stepErrors("type", empty)).toEqual({ coaching_formats: "required.coaching_formats" });
    // Competition levels and every other profile field are optional.
    expect(stepErrors("type", { ...empty, coaching_formats: ["group_coaching"] })).toEqual({});
  });

  it("sends only the step's changed, valid fields: trimmed, empty text as null, lists as given", () => {
    const values = {
      ...valuesFrom(coach(PROFILE)),
      brand_name: "  Sam Boxing ",
      bio: "",
      city: "x".repeat(81),
      languages: [],
      coaching_formats: ["online_coaching" as const],
    };
    const dirty = {
      brand_name: true,
      bio: true,
      city: true,
      languages: true,
      coaching_formats: true,
    };
    const errors = stepErrors("profile", values);
    expect(stepPatch("profile", values, dirty, errors)).toEqual({
      brand_name: "Sam Boxing",
      bio: null,
      languages: [],
    });
    expect(stepPatch("type", values, dirty)).toEqual({ coaching_formats: ["online_coaching"] });
    expect(stepPatch("profile", values, {})).toEqual({});
  });

  it("suggests the account name only for a new profile with no saved coach name", () => {
    expect(nameSuggestion(coach({}, "not_started"), "  Alex Novak ")).toBe("Alex Novak");
    expect(nameSuggestion(coach({}, "not_started"), null)).toBeUndefined();
    expect(nameSuggestion(coach({}, "not_started"), "x".repeat(61))).toBeUndefined();
    expect(nameSuggestion(coach({ city: "Kraków" }), "Alex Novak")).toBeUndefined();
    expect(nameSuggestion(coach({ display_name: "Coach Sam" }, "not_started"), "Alex")).toBe(
      undefined,
    );
  });

  it("maps the backend's stable codes, never its messages", () => {
    const error = ApiError.fromResponse(
      422,
      {
        error: {
          code: "validation_error",
          message: "anything",
          details: {
            fields: {},
            field_codes: {
              display_name: ["required"],
              languages: ["invalid"],
              country_code: ["invalid_choice"],
              bio: ["invalid_format"],
              brand_name: ["too_long"],
              account_registration: ["required"],
            },
          },
        },
      },
      null,
    );
    expect(rejectionOf(error)).toEqual({
      fields: {
        display_name: "required.display_name",
        languages: "invalid",
        country_code: "invalidChoice",
        bio: "invalidFormat",
        brand_name: "tooLong",
      },
      missing: ["display_name"],
      accountRegistration: true,
    });
    expect(rejectionOf(new TypeError("offline"))).toBeUndefined();
  });
});
