import type { FighterProfile, FighterProfilePatch } from "@/entities/fighter-profile";
import {
  FighterProfileUpdateRequestExperienceLevel,
  FighterProfileUpdateRequestGoalsItem,
  FighterProfileUpdateRequestStance,
  FighterProfileUpdateRequestWeightClass,
  type FighterProfileUpdateRequestExperienceLevel as ExperienceLevel,
  type FighterProfileUpdateRequestGoalsItem as Goal,
  type FighterProfileUpdateRequestStance as Stance,
  type FighterProfileUpdateRequestWeightClass as WeightClass,
} from "@/shared/api/generated/model";
import { isApiError } from "@/shared/api/http/api-error";

import type { FormStepId } from "./steps";

/*
 * The OF1–OF4 form values and their translation to and from the SF-25
 * profile, the same rules as the web client's (SF-38, SF-27). The
 * vocabularies are the generated OpenAPI enums in contract order: no
 * mobile-only values. Numbers stay text while typed and are parsed only to be
 * sent; nothing is rounded, so a weight with more than one decimal goes to
 * the API as typed and comes back as `invalid_format`. Only the fields the
 * person changed are ever sent, so a value saved meanwhile by another client
 * is never overwritten with a stale one.
 */

export const EXPERIENCE_LEVELS = Object.values(FighterProfileUpdateRequestExperienceLevel);
export const STANCES = Object.values(FighterProfileUpdateRequestStance);
export const GOALS = Object.values(FighterProfileUpdateRequestGoalsItem);
export const WEIGHT_CLASSES = Object.values(FighterProfileUpdateRequestWeightClass);

export type FighterValues = {
  display_name: string;
  username: string;
  country_code: string | null;
  city: string;
  experience_level: ExperienceLevel | null;
  amateur_bout_count: string;
  stance: Stance | null;
  goals: Goal[];
  /** `YYYY-MM-DD`, or "" while the typed date is empty or incomplete. */
  next_fight_on: string;
  next_fight_name: string;
  weight_class: WeightClass | null;
  current_weight_kg: string;
  height_cm: string;
};

export type FighterField = keyof FighterValues;
export type Dirty = Partial<Record<FighterField, boolean>>;

/** The fields each form step edits. */
export const STEP_FIELDS: Record<FormStepId, readonly FighterField[]> = {
  account: ["display_name", "username", "country_code", "city"],
  experience: ["experience_level", "amateur_bout_count", "stance"],
  goals: ["goals", "next_fight_on", "next_fight_name"],
  weight: ["weight_class", "current_weight_kg", "height_cm"],
};

const text = (value: string | null | undefined) => value ?? "";
const number = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

export function valuesFrom(profile: FighterProfile): FighterValues {
  return {
    display_name: text(profile.display_name),
    username: text(profile.username),
    country_code: profile.country_code ?? null,
    city: text(profile.city),
    experience_level: profile.experience_level ?? null,
    amateur_bout_count: number(profile.amateur_bout_count),
    stance: profile.stance ?? null,
    goals: [...(profile.goals ?? [])],
    next_fight_on: text(profile.next_fight_on),
    next_fight_name: text(profile.next_fight_name),
    weight_class: profile.weight_class ?? null,
    current_weight_kg: number(profile.current_weight_kg),
    height_cm: number(profile.height_cm),
  };
}

/**
 * The backend's values for every field the person has not changed, and
 * their own edits for the rest: a refetch (another client saved) updates
 * untouched fields and never discards an unsaved edit.
 */
export function mergeServer(
  current: FighterValues,
  dirty: Dirty,
  profile: FighterProfile,
): FighterValues {
  const server = valuesFrom(profile);
  const merged = { ...server };
  for (const field of Object.keys(dirty) as FighterField[]) {
    if (dirty[field] === true) (merged as Record<FighterField, unknown>)[field] = current[field];
  }
  return merged;
}

export type FieldMessage =
  | `required.${"display_name" | "username" | "country_code" | "city" | "experience_level" | "stance"}`
  | "usernameFormat"
  | "usernameTaken"
  | "weightPrecision"
  | "wholeNumber"
  | "tooLong"
  | "outOfRange"
  | "invalidChoice"
  | "invalidDate"
  | "invalid";

export type Errors = Partial<Record<FighterField, FieldMessage>>;

/** The backend's username rule (SF-25), mirrored for immediate feedback only. */
export const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_]{1,28}[A-Za-z0-9]$/;

/** Trimmed text, or `null` (the API's "clear this field") when empty. */
const orNull = (value: string) => (value.trim() === "" ? null : value.trim());

/**
 * A step's Continue checks before saving: its completion requirements and
 * shapes the API would reject, for immediate feedback. The API stays the
 * authority: its answer replaces these.
 */
export function stepErrors(step: FormStepId, values: FighterValues, dateText = ""): Errors {
  const errors: Errors = {};
  if (step === "account") {
    if (values.display_name.trim() === "") errors.display_name = "required.display_name";
    if (values.username.trim() === "") errors.username = "required.username";
    else if (!USERNAME_PATTERN.test(values.username.trim())) errors.username = "usernameFormat";
    if (values.country_code === null) errors.country_code = "required.country_code";
    if (values.city.trim() === "") errors.city = "required.city";
  }
  if (step === "experience") {
    if (values.experience_level === null) errors.experience_level = "required.experience_level";
    if (values.stance === null) errors.stance = "required.stance";
    const bouts = values.amateur_bout_count.trim();
    if (bouts !== "" && !/^\d+$/.test(bouts)) errors.amateur_bout_count = "wholeNumber";
  }
  if (step === "goals") {
    if (values.next_fight_on === "" && dateText !== "") errors.next_fight_on = "invalidDate";
  }
  if (step === "weight") {
    const weight = values.current_weight_kg.trim().replace(",", ".");
    if (weight !== "" && !/^\d+(\.\d+)?$/.test(weight)) errors.current_weight_kg = "invalid";
    const height = values.height_cm.trim();
    if (height !== "" && !/^\d+$/.test(height)) errors.height_cm = "outOfRange";
  }
  return errors;
}

/**
 * The PATCH for `step`: only the fields the person changed there, minus any
 * that failed the checks (an invalid request changes nothing, so it would
 * block the valid ones). Empty text clears an optional field (`null`); a
 * decimal comma is read as a point; nothing is rounded.
 */
export function stepPatch(
  step: FormStepId,
  values: FighterValues,
  dirty: Dirty,
  errors: Errors = {},
): FighterProfilePatch {
  const patch: Record<string, unknown> = {};
  for (const field of STEP_FIELDS[step]) {
    if (dirty[field] !== true || errors[field] !== undefined) continue;
    switch (field) {
      case "display_name":
      case "username":
      case "city":
      case "next_fight_name":
        patch[field] = orNull(values[field]);
        break;
      case "next_fight_on":
        patch[field] = values.next_fight_on === "" ? null : values.next_fight_on;
        break;
      case "amateur_bout_count":
      case "height_cm": {
        const raw = values[field].trim();
        patch[field] = raw === "" ? null : Number(raw);
        break;
      }
      case "current_weight_kg": {
        const raw = values.current_weight_kg.trim().replace(",", ".");
        patch[field] = raw === "" ? null : Number(raw);
        break;
      }
      default:
        patch[field] = values[field];
    }
  }
  return patch as FighterProfilePatch;
}

const REQUIRED = new Set([
  "display_name",
  "username",
  "country_code",
  "city",
  "experience_level",
  "stance",
]);
const WHOLE_NUMBERS = new Set(["amateur_bout_count", "height_cm"]);

/** The message for the first reason code of `field` (stable codes, never English messages). */
export function messageFor(field: string, code: string): FieldMessage {
  if (code === "required" && REQUIRED.has(field)) return `required.${field}` as FieldMessage;
  if (field === "username" && code === "already_exists") return "usernameTaken";
  if (
    field === "username" &&
    (code === "invalid_format" || code === "too_short" || code === "too_long")
  ) {
    return "usernameFormat";
  }
  if (field === "current_weight_kg" && code === "invalid_format") return "weightPrecision";
  if (WHOLE_NUMBERS.has(field) && (code === "invalid_type" || code === "out_of_range")) {
    return field === "amateur_bout_count" ? "wholeNumber" : "outOfRange";
  }
  if (field === "next_fight_on") return "invalidDate";
  if (code === "too_long") return "tooLong";
  if (code === "out_of_range") return "outOfRange";
  if (code === "invalid_choice") return "invalidChoice";
  return "invalid";
}

export type Rejection = {
  fields: Errors;
  /** Profile fields with a `required` code (completion). */
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
    const code = codes[0] ?? "invalid";
    if (field === "account_registration") {
      accountRegistration = true;
      continue;
    }
    (fields as Record<string, FieldMessage>)[field] = messageFor(field, code);
    if (codes.includes("required")) missing.push(field);
  }
  return { fields, missing, accountRegistration };
}
