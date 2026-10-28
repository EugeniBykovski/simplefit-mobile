import type { Entry } from "./entry";
import { gymWorkspaceOptions } from "./gyms";

const workspace = (
  gym_id: string,
  setup_status: "draft" | "completed",
  available_actions: ("enter" | "continue_setup")[],
  role: "owner" | "manager" | "coach" | "front_desk" = "owner",
) => ({ gym_id, name: gym_id, role, setup_status, available_actions, selected: false });

const entryWith = (
  gym_workspaces: Entry["gym_workspaces"],
  gym_workspace_count = gym_workspaces.length,
) => ({ gym_workspaces, gym_workspace_count }) as Entry;

describe("gymWorkspaceOptions (SF-84 gym_workspaces)", () => {
  it("opens only what the backend allows: enter a completed gym, continue the owner's draft", () => {
    const options = gymWorkspaceOptions(
      entryWith([
        workspace("a", "completed", ["enter"]),
        workspace("b", "completed", ["enter"], "coach"),
        workspace("draft", "draft", ["continue_setup"]),
        // Someone else's draft where the user is staff: nothing to do from a chooser.
        workspace("other-draft", "draft", [], "manager"),
      ]),
    );
    expect(options.enter.map((gym) => gym.gym_id)).toEqual(["a", "b"]);
    expect(options.setup.map((gym) => gym.gym_id)).toEqual(["draft"]);
    expect(options.more).toBe(false);
  });

  it("reports more gyms than the entry lists, for the chooser's pages", () => {
    expect(gymWorkspaceOptions(entryWith([workspace("a", "completed", ["enter"])], 30)).more).toBe(
      true,
    );
  });

  it("is empty for an account without gyms", () => {
    expect(gymWorkspaceOptions(entryWith([]))).toEqual({ enter: [], setup: [], more: false });
  });
});
