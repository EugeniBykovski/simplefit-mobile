/**
 * GR2, the gym owner's mobile introduction (SF-92; Claude Design 112,
 * `FirstRunGCheckinTip`): the four MVP steps on real mounted UI, then the
 * complete card. The six FUTURE steps of the artboard (`f-pulse`,
 * `f-checkin`, `f-classes`, `f-members`, `f-staff`, `f-announce`) point at
 * features that do not exist and are not here.
 *
 * Targets are spotlight ids (`useSpotlightTarget`): the checklist and the gym
 * card of Gym pulse, the whole gym tab bar (`tabs:bar`, its Soon items) and
 * the identity pill (the A04 switcher; highlighting it switches nothing).
 */
export type GymTourStepId = "checklist" | "gym" | "tabs" | "switcher";

export type GymTourStep = {
  id: GymTourStepId;
  target: string;
  /** Where Gym pulse scrolls before measuring: a content card, the top, or nothing (the tab bar). */
  reveal: "content" | "top" | "none";
  /** Ring growth around the target and its corner radius, from the artboard. */
  padding: number;
  radius: number;
};

export const GYM_TOUR_TARGETS = {
  checklist: "gym:checklist",
  gym: "gym:summary",
  tabs: "tabs:bar",
  switcher: "gym:identity",
} as const;

export const GYM_TOUR_STEPS: readonly GymTourStep[] = [
  {
    id: "checklist",
    target: GYM_TOUR_TARGETS.checklist,
    reveal: "content",
    padding: 6,
    radius: 22,
  },
  { id: "gym", target: GYM_TOUR_TARGETS.gym, reveal: "content", padding: 6, radius: 22 },
  { id: "tabs", target: GYM_TOUR_TARGETS.tabs, reveal: "none", padding: 4, radius: 36 },
  { id: "switcher", target: GYM_TOUR_TARGETS.switcher, reveal: "top", padding: 4, radius: 24 },
];

/** The complete card points back at the checklist (artboard `done`). */
export const GYM_TOUR_DONE: GymTourStep = GYM_TOUR_STEPS[0]!;
