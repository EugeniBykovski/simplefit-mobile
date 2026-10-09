import type { FighterProfile } from "@/entities/fighter-profile";
import { ApiError } from "@/shared/api/http/api-error";

import {
  EXPERIENCE_LEVELS,
  GOALS,
  STANCES,
  WEIGHT_CLASSES,
  mergeServer,
  rejectionOf,
  stepErrors,
  stepPatch,
  valuesFrom,
} from "./form";
import { STEPS, STEP_IDS, decideStep, nextStep, previousStep, resumeStep } from "./steps";

const profile = (overrides: Partial<FighterProfile> = {}, missing: string[] = []): FighterProfile =>
  ({
    display_name: null,
    username: null,
    country_code: null,
    city: null,
    experience_level: null,
    amateur_bout_count: null,
    stance: null,
    goals: [],
    next_fight_on: null,
    next_fight_name: null,
    weight_class: null,
    current_weight_kg: null,
    height_cm: null,
    onboarding: { status: "in_progress", completed_at: null, missing_requirements: missing },
    ...overrides,
  }) as FighterProfile;

const ALL = ["display_name", "username", "country_code", "city", "experience_level", "stance"];

describe("steps", () => {
  it("are the artboards' eleven steps in order, Skip where they draw it", () => {
    expect(STEPS.map((step) => step.artboard)).toEqual(
      Array.from({ length: 11 }, (_, index) => `OF${index + 1}`),
    );
    expect(STEPS.filter((step) => step.skippable).map((step) => step.id)).toEqual([
      "goals",
      "weight",
      "gym",
      "membership",
      "coach",
      "friends",
      "notifications",
    ]);
    expect(nextStep("account")).toBe("experience");
    expect(previousStep("account")).toBeUndefined();
    expect(previousStep("complete")).toBe("notifications");
    expect(STEP_IDS).toHaveLength(11);
  });

  it("resume at the earliest step with a missing requirement, else at Goals", () => {
    expect(resumeStep(profile({}, ALL))).toBe("account");
    expect(resumeStep(profile({}, ["stance"]))).toBe("experience");
    expect(resumeStep(profile({}, []))).toBe("goals");
  });

  it("never lets a link skip a required step, fake completion or restart a completed profile", () => {
    const fresh = profile({}, ALL);
    expect(decideStep(fresh, "notifications", false)).toEqual({ kind: "step", step: "account" });
    expect(decideStep(fresh, "complete", false)).toEqual({ kind: "step", step: "account" });
    expect(decideStep(fresh, "garbage", false)).toEqual({ kind: "step", step: "account" });
    const ready = profile({}, []);
    expect(decideStep(ready, "privacy", false)).toEqual({ kind: "step", step: "privacy" });
    expect(decideStep(ready, "account", false)).toEqual({ kind: "step", step: "account" });
    const done = profile({
      onboarding: {
        status: "completed",
        completed_at: "2026-10-09T10:00:00Z",
        missing_requirements: [],
      },
    } as Partial<FighterProfile>);
    expect(decideStep(done, "account", false)).toEqual({ kind: "exit" });
    expect(decideStep(done, "complete", false)).toEqual({ kind: "exit" });
    expect(decideStep(done, undefined, true)).toEqual({ kind: "step", step: "complete" });
  });
});

describe("form", () => {
  it("uses the contract's vocabularies in contract order", () => {
    expect(EXPERIENCE_LEVELS).toEqual([
      "new_to_boxing",
      "recreational",
      "amateur",
      "competitive_amateur",
      "professional",
    ]);
    expect(STANCES).toEqual(["orthodox", "southpaw", "switch"]);
    expect(GOALS).toEqual([
      "fitness",
      "learn_boxing",
      "improve_technique",
      "competition",
      "fight_preparation",
    ]);
    expect(WEIGHT_CLASSES).toEqual([
      "minus_63_5",
      "minus_67",
      "minus_71",
      "minus_75",
      "minus_80",
      "minus_86",
      "plus_86",
      "not_sure",
    ]);
  });

  it("sends only the changed fields of the step, never rounding or shifting", () => {
    const values = {
      ...valuesFrom(profile({ city: "Warsaw" })),
      stance: "southpaw" as const,
      current_weight_kg: "73,85",
      height_cm: "178",
      next_fight_on: "2026-11-03",
    };
    expect(stepPatch("experience", values, { stance: true })).toEqual({ stance: "southpaw" });
    expect(stepPatch("account", values, { stance: true })).toEqual({});
    expect(stepPatch("weight", values, { current_weight_kg: true, height_cm: true })).toEqual({
      current_weight_kg: 73.85,
      height_cm: 178,
    });
    expect(stepPatch("goals", values, { next_fight_on: true })).toEqual({
      next_fight_on: "2026-11-03",
    });
    expect(
      stepPatch("goals", { ...values, next_fight_name: "  " }, { next_fight_name: true }),
    ).toEqual({ next_fight_name: null });
  });

  it("checks a step's requirements and shapes before saving", () => {
    const empty = valuesFrom(profile());
    expect(stepErrors("account", { ...empty, username: "a" })).toEqual({
      display_name: "required.display_name",
      username: "usernameFormat",
      country_code: "required.country_code",
      city: "required.city",
    });
    expect(stepErrors("experience", { ...empty, amateur_bout_count: "1.5" })).toEqual({
      experience_level: "required.experience_level",
      stance: "required.stance",
      amateur_bout_count: "wholeNumber",
    });
    expect(stepErrors("goals", empty, "03.11")).toEqual({ next_fight_on: "invalidDate" });
    expect(stepErrors("weight", { ...empty, current_weight_kg: "abc" })).toEqual({
      current_weight_kg: "invalid",
    });
  });

  it("a refetch updates untouched fields and keeps unsaved edits", () => {
    const local = { ...valuesFrom(profile({ city: "Warsaw" })), stance: "switch" as const };
    const merged = mergeServer(
      local,
      { stance: true },
      profile({ city: "Kraków", stance: "orthodox" }),
    );
    expect(merged.city).toBe("Kraków");
    expect(merged.stance).toBe("switch");
  });

  it("maps the API's codes, completion's missing requirements and the account gate", () => {
    const error = ApiError.fromResponse(
      422,
      {
        error: {
          code: "validation_error",
          message: "x",
          details: {
            field_codes: {
              username: ["already_exists"],
              current_weight_kg: ["invalid_format"],
              city: ["required"],
              account_registration: ["required"],
            },
          },
        },
      },
      null,
    );
    expect(rejectionOf(error)).toEqual({
      fields: {
        username: "usernameTaken",
        current_weight_kg: "weightPrecision",
        city: "required.city",
      },
      missing: ["city"],
      accountRegistration: true,
    });
    expect(rejectionOf(ApiError.network(new Error("x")))).toBeUndefined();
  });
});
