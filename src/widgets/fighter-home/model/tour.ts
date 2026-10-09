/**
 * The Fighter mobile product tour (Claude Design 34a FR5, 7 steps + complete),
 * pointing at real mounted UI: spotlight targets registered by the home
 * screen and the Fighter tab bar (`tab:<item>`). It is help, not onboarding:
 * opened from Help (?) or the Live Board card, replayable, and it records
 * nothing (the backend keeps only the introduction's outcome, FR1–FR3).
 */
export type TourStepId =
  | "checklist"
  | "board"
  | "training"
  | "community"
  | "profile"
  | "notifications"
  | "identity"
  | "done";

export type TourStep = {
  id: TourStepId;
  /** The spotlight target (`useSpotlightTarget` id). */
  target: string;
  /** Ring growth around the target and its corner radius, from the artboard. */
  padding: number;
  radius: number;
};

export const TOUR_STEPS: readonly TourStep[] = [
  { id: "checklist", target: "home:checklist", padding: 6, radius: 22 },
  { id: "board", target: "tab:board", padding: 4, radius: 28 },
  { id: "training", target: "tab:training", padding: 4, radius: 24 },
  { id: "community", target: "tab:community", padding: 4, radius: 24 },
  { id: "profile", target: "tab:profile", padding: 4, radius: 24 },
  { id: "notifications", target: "home:notifications", padding: 4, radius: 22 },
  { id: "identity", target: "home:identity", padding: 4, radius: 22 },
  { id: "done", target: "home:help", padding: 4, radius: 22 },
];

/** The numbered steps (the last is the completion card). */
export const TOUR_LENGTH = TOUR_STEPS.length - 1;
