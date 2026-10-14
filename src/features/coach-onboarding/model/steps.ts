import type { CoachProfile } from "@/entities/coach-profile";

/**
 * The Coach mobile registration (Claude Design COACH 3, version
 * 1791966129-8ecb; route registry `mobile.onboarding.coach`, `?step=`):
 * OC1 `profile`, OC2 `type`, OC11 `complete`. OC3–OC10 (credentials,
 * business size, gym, plan, services, payouts, invitations, data rules) are
 * FUTURE and never part of the flow: their domains do not exist.
 *
 * The step param is navigation only. SF-50 persists the profile, not a wizard
 * cursor, so where a person lands is derived from the backend state alone,
 * and completion is the backend's.
 */
export const STEP_IDS = ["profile", "type", "complete"] as const;

export type StepId = (typeof STEP_IDS)[number];
export type FormStepId = Exclude<StepId, "complete">;

/** The steps the progress bar counts (OC1, OC2; OC11 shows it full). */
export const FORM_STEPS: readonly FormStepId[] = ["profile", "type"];

/** The design artboard of each step. */
export const ARTBOARDS: Record<StepId, string> = { profile: "OC1", type: "OC2", complete: "OC11" };

export function isFormStep(value: unknown): value is FormStepId {
  return value === "profile" || value === "type";
}

type Requirement = CoachProfile["onboarding"]["missing_requirements"][number];

/** The step that asks for each completion requirement (`missing_requirements`). */
export const REQUIREMENT_STEP: Record<Requirement, FormStepId> = {
  display_name: "profile",
  country_code: "profile",
  city: "profile",
  coaching_formats: "type",
};

/**
 * Resume policy, from the backend profile alone: the earliest step with a
 * missing requirement, else Coaching type, whose Finish is the only
 * completion action. Nothing optional decides it and no visited step is
 * claimed.
 */
export function resumeStep(profile: CoachProfile): FormStepId {
  return profile.onboarding.missing_requirements.some(
    (requirement) => REQUIREMENT_STEP[requirement] === "profile",
  )
    ? "profile"
    : "type";
}

export type StepDecision = { kind: "step"; step: StepId } | { kind: "exit" };

/**
 * What the route shows for the backend `profile` and the requested `?step=`:
 *
 * - A completed profile shows OC11 only right after this screen completed it
 *   (`justCompleted`); otherwise the person leaves for the application entry,
 *   so neither an old link nor `?step=complete` restarts or fakes anything.
 * - An unfinished profile shows a requested form step (both stay editable;
 *   neither completes anything), and otherwise, including `complete`, a
 *   FUTURE step or garbage, the resume step.
 */
export function decideStep(
  profile: CoachProfile,
  requested: unknown,
  justCompleted: boolean,
): StepDecision {
  if (profile.onboarding.status === "completed") {
    return justCompleted ? { kind: "step", step: "complete" } : { kind: "exit" };
  }
  if (isFormStep(requested)) return { kind: "step", step: requested };
  return { kind: "step", step: resumeStep(profile) };
}
