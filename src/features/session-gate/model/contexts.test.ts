import type { Entry } from "./entry";
import { contextOptions } from "./contexts";

jest.mock("@/entities/session", () => ({ callWithSession: jest.fn() }));

const entry = (overrides: Partial<Entry>): Entry => ({
  destination: "fighter_home",
  reason: "fighter_onboarding_completed",
  mandatory: false,
  intent: null,
  context: null,
  account_registration: "complete",
  fighter_profile: "completed",
  coach_profile: "not_started",
  capabilities: ["FIGHTER"],
  gym_id: null,
  gym_workspaces: [],
  gym_workspace_count: 0,
  ...overrides,
});

describe("contextOptions (SF-55)", () => {
  it("counts a context as completed only through its capability", () => {
    expect(contextOptions(entry({}))).toEqual({
      completed: ["fighter"],
      journeys: [{ context: "coach", started: false }],
    });
    // A completed profile status without the capability is still a journey.
    expect(contextOptions(entry({ coach_profile: "completed" })).completed).toEqual(["fighter"]);
  });

  it("lists both completed contexts, Fighter first, and no journeys", () => {
    expect(
      contextOptions(entry({ coach_profile: "completed", capabilities: ["COACH", "FIGHTER"] })),
    ).toEqual({ completed: ["fighter", "coach"], journeys: [] });
  });

  it("E11: two journeys in progress, nothing completed", () => {
    expect(
      contextOptions(
        entry({
          destination: "context_selection",
          fighter_profile: "in_progress",
          coach_profile: "in_progress",
          capabilities: [],
        }),
      ),
    ).toEqual({
      completed: [],
      journeys: [
        { context: "fighter", started: true },
        { context: "coach", started: true },
      ],
    });
  });
});
