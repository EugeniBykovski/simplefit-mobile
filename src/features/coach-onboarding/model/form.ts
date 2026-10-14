import type { CoachProfile, CoachProfilePatch } from "@/entities/coach-profile";
import {
  CoachProfileUpdateRequestCoachingFormatsItem,
  CoachProfileUpdateRequestCompetitionLevelsItem,
  CoachProfileUpdateRequestLanguagesItem,
  type CoachProfileUpdateRequestCoachingFormatsItem as CoachingFormat,
  type CoachProfileUpdateRequestCompetitionLevelsItem as CompetitionLevel,
  type CoachProfileUpdateRequestLanguagesItem as Language,
} from "@/shared/api/generated/model";
import { isApiError } from "@/shared/api/http/api-error";

import type { FormStepId } from "./steps";

/*
 * The OC1 and OC2 form values and their translation to and from the SF-50
 * profile, the same rules as the web client's (SF-52). The vocabularies are
 * the generated OpenAPI enums in contract order: no mobile-only values. The
 * lengths mirror the contract for immediate feedback only; the API stays the
 * authority. Only the fields the person changed are ever sent, so a value
 * saved meanwhile by another client is never overwritten with a stale one.
 */

export const COACHING_FORMATS = Object.values(CoachProfileUpdateRequestCoachingFormatsItem);
export const COMPETITION_LEVELS = Object.values(CoachProfileUpdateRequestCompetitionLevelsItem);
export const LANGUAGES = Object.values(CoachProfileUpdateRequestLanguagesItem);

export const LIMITS = { display_name: 60, brand_name: 80, city: 80, bio: 500 } as const;

/** Characters as the API counts them (code points, not UTF-16 units), after trimming. */
export const lengthOf = (value: string) => Array.from(value.trim()).length;

export type CoachValues = {
  display_name: string;
  brand_name: string;
  country_code: string | null;
  city: string;
  bio: string;
  languages: Language[];
  coaching_formats: CoachingFormat[];
  competition_levels: CompetitionLevel[];
};

export type CoachField = keyof CoachValues;
export type Dirty = Partial<Record<CoachField, boolean>>;

/** The fields each form step edits. */
export const STEP_FIELDS: Record<FormStepId, readonly CoachField[]> = {
  profile: ["display_name", "brand_name", "country_code", "city", "bio", "languages"],
  type: ["coaching_formats", "competition_levels"],
};

const text = (value: string | null | undefined) => value ?? "";

export function valuesFrom(profile: CoachProfile): CoachValues {
  return {
    display_name: text(profile.display_name),
    brand_name: text(profile.brand_name),
    country_code: profile.country_code ?? null,
    city: text(profile.city),
    bio: text(profile.bio),
    languages: [...profile.languages],
    coaching_formats: [...profile.coaching_formats],
    competition_levels: [...profile.competition_levels],
  };
}

/** `selected` with `value` toggled, kept in the contract's order (never a repeated value). */
export function toggled<T extends string>(order: readonly T[], selected: readonly T[], value: T) {
  const next = new Set(selected);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return order.filter((item) => next.has(item));
}

export type FieldMessage =
  | `required.${"display_name" | "country_code" | "city" | "coaching_formats"}`
  | "tooLong"
  | "invalidChoice"
  | "invalidFormat"
  | "invalid";

export type Errors = Partial<Record<CoachField, FieldMessage>>;

/**
 * A step's Continue or Finish checks before saving: its completion
 * requirements and the contract lengths, as the API would report them. The
 * API stays the authority: its answer replaces these.
 */
export function stepErrors(step: FormStepId, values: CoachValues): Errors {
  const errors: Errors = {};
  if (step === "profile") {
    if (values.display_name.trim() === "") errors.display_name = "required.display_name";
    if (values.country_code === null) errors.country_code = "required.country_code";
    if (values.city.trim() === "") errors.city = "required.city";
    for (const field of ["display_name", "brand_name", "city", "bio"] as const) {
      if (errors[field] === undefined && lengthOf(values[field]) > LIMITS[field])
        errors[field] = "tooLong";
    }
  }
  if (step === "type" && values.coaching_formats.length === 0) {
    errors.coaching_formats = "required.coaching_formats";
  }
  return errors;
}

/** Trimmed text, or `null` (the API's "clear this field") when empty. */
const orNull = (value: string) => (value.trim() === "" ? null : value.trim());

/**
 * The PATCH for `step`: only the fields the person changed there, minus any
 * that failed the checks (an invalid request changes nothing, so it would
 * block the valid ones). Empty text clears an optional field (`null`); an
 * empty list is sent as `[]`. Nothing is truncated or coerced.
 */
export function stepPatch(
  step: FormStepId,
  values: CoachValues,
  dirty: Dirty,
  errors: Errors = {},
): CoachProfilePatch {
  const patch: Record<string, unknown> = {};
  for (const field of STEP_FIELDS[step]) {
    if (dirty[field] !== true || errors[field] !== undefined) continue;
    switch (field) {
      case "display_name":
      case "brand_name":
      case "city":
      case "bio":
        patch[field] = orNull(values[field]);
        break;
      default:
        patch[field] = values[field];
    }
  }
  return patch as CoachProfilePatch;
}

/**
 * The editable coach-name suggestion for a new, unsaved profile: the
 * account's full name, offered in the field and saved only when the person
 * continues with it. Never for a profile with a saved name, never past the
 * contract length, and never written to the account.
 */
export function nameSuggestion(
  profile: CoachProfile,
  fullName: string | null | undefined,
): string | undefined {
  if (profile.onboarding.status !== "not_started" || profile.display_name !== null)
    return undefined;
  const name = fullName?.trim() ?? "";
  return name === "" || lengthOf(name) > LIMITS.display_name ? undefined : name;
}

const REQUIRED = new Set(["display_name", "country_code", "city", "coaching_formats"]);

/** The message for the first reason code of `field` (stable SF-50 codes, never English messages). */
export function messageFor(field: string, code: string): FieldMessage {
  if (code === "required" && REQUIRED.has(field)) return `required.${field}` as FieldMessage;
  if (code === "too_long") return "tooLong";
  if (code === "invalid_choice") return "invalidChoice";
  if (code === "invalid_format") return "invalidFormat";
  return "invalid";
}

export type Rejection = {
  fields: Errors;
  /** Profile fields with a `required` code (completion), in API order. */
  missing: string[];
  /** Completion needs the shared account registration first (SF-44). */
  accountRegistration: boolean;
};

/** A backend `validation_error` as field messages, or `undefined` for any other error. */
export function rejectionOf(error: unknown): Rejection | undefined {
  if (!isApiError(error) || error.code !== "validation_error") return undefined;
  const fields: Errors = {};
  const missing: string[] = [];
  let accountRegistration = false;
  for (const [field, codes] of Object.entries(error.fieldCodes)) {
    if (field === "account_registration") {
      accountRegistration = true;
      continue;
    }
    (fields as Record<string, FieldMessage>)[field] = messageFor(field, codes[0] ?? "invalid");
    if (codes.includes("required")) missing.push(field);
  }
  return { fields, missing, accountRegistration };
}
