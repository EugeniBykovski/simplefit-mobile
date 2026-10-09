import type { FighterProfile } from "@/entities/fighter-profile";

/**
 * The Fighter mobile registration (Claude Design FIGHTER 2, OF1–OF11; route
 * registry `mobile.onboarding.fighter`, `?step=`): one typed, ordered
 * definition of the eleven steps. It decides presentation and navigation
 * only. SF-25 persists the profile, not a wizard cursor, so where a person
 * lands is derived from the backend state, and completion is the backend's.
 *
 * - `form` steps edit SF-25 fields (OF1–OF4);
 * - `info` steps (OF5–OF10) have no backend domain yet (gym, membership,
 *   coach, privacy preferences, friends, notification preferences): they say
 *   truthfully what will come and record nothing (SF-39 decision);
 * - `complete` (OF11) shows only after the backend confirmed completion.
 */
export const STEP_IDS = [
  "account",
  "experience",
  "goals",
  "weight",
  "gym",
  "membership",
  "coach",
  "privacy",
  "friends",
  "notifications",
  "complete",
] as const;

export type StepId = (typeof STEP_IDS)[number];
export type FormStepId = "account" | "experience" | "goals" | "weight";
export type InfoStepId = "gym" | "membership" | "coach" | "privacy" | "friends" | "notifications";

export type StepDefinition = {
  id: StepId;
  /** OF1–OF11. */
  artboard: string;
  kind: "form" | "info" | "complete";
  /** The artboard draws Skip in the header. */
  skippable: boolean;
};

export const STEPS: readonly StepDefinition[] = [
  { id: "account", artboard: "OF1", kind: "form", skippable: false },
  { id: "experience", artboard: "OF2", kind: "form", skippable: false },
  { id: "goals", artboard: "OF3", kind: "form", skippable: true },
  { id: "weight", artboard: "OF4", kind: "form", skippable: true },
  { id: "gym", artboard: "OF5", kind: "info", skippable: true },
  { id: "membership", artboard: "OF6", kind: "info", skippable: true },
  { id: "coach", artboard: "OF7", kind: "info", skippable: true },
  { id: "privacy", artboard: "OF8", kind: "info", skippable: false },
  { id: "friends", artboard: "OF9", kind: "info", skippable: true },
  { id: "notifications", artboard: "OF10", kind: "info", skippable: true },
  { id: "complete", artboard: "OF11", kind: "complete", skippable: false },
];

export const TOTAL_STEPS = STEPS.length;

export function stepIndex(id: StepId): number {
  return STEP_IDS.indexOf(id);
}

export function isStepId(value: unknown): value is StepId {
  return typeof value === "string" && (STEP_IDS as readonly string[]).includes(value);
}

/** The step after `id` (`complete` is reached only through the backend). */
export function nextStep(id: StepId): StepId {
  return STEP_IDS[Math.min(stepIndex(id) + 1, TOTAL_STEPS - 1)] ?? "complete";
}

/** The step before `id`, or `undefined` on OF1 (Back leaves the flow). */
export function previousStep(id: StepId): StepId | undefined {
  const index = stepIndex(id);
  return index > 0 ? STEP_IDS[index - 1] : undefined;
}

/** The last step before completion: its Continue asks the backend to complete. */
export const FINAL_STEP: StepId = "notifications";

type Requirement = FighterProfile["onboarding"]["missing_requirements"][number];

/** The step that asks for each completion requirement (`missing_requirements`). */
export const REQUIREMENT_STEP: Record<Requirement, FormStepId> = {
  display_name: "account",
  username: "account",
  country_code: "account",
  city: "account",
  experience_level: "experience",
  stance: "experience",
};

/**
 * Resume policy: the earliest step with a missing requirement; when none is
 * missing (a profile begun here or on the web), OF3 Goals, the first step
 * after the required ones. SF-25 stores no wizard cursor, so this is derived
 * from backend data alone.
 */
export function resumeStep(profile: FighterProfile): FormStepId {
  const missing = profile.onboarding.missing_requirements;
  if (missing.some((requirement) => REQUIREMENT_STEP[requirement] === "account")) return "account";
  if (missing.some((requirement) => REQUIREMENT_STEP[requirement] === "experience"))
    return "experience";
  return "goals";
}

export type StepDecision = { kind: "step"; step: StepId } | { kind: "exit" };

/**
 * What the route shows for the backend `profile` and the requested `?step=`:
 *
 * - A completed profile shows OF11 only right after this screen completed it
 *   (`justCompleted`); otherwise the person leaves for the application entry,
 *   so neither an old link nor `?step=complete` restarts or fakes anything.
 * - An unfinished profile shows a requested step up to the resume step, or
 *   any step once nothing required is missing; a later step, `complete` or
 *   garbage resolves to the resume step, so no link skips a required step.
 */
export function decideStep(
  profile: FighterProfile,
  requested: unknown,
  justCompleted: boolean,
): StepDecision {
  if (profile.onboarding.status === "completed") {
    return justCompleted ? { kind: "step", step: "complete" } : { kind: "exit" };
  }
  const resume = resumeStep(profile);
  if (!isStepId(requested) || requested === "complete") return { kind: "step", step: resume };
  const open = profile.onboarding.missing_requirements.length === 0;
  return open || stepIndex(requested) <= stepIndex(resume)
    ? { kind: "step", step: requested }
    : { kind: "step", step: resume };
}
