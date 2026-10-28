import { rootTitleKey } from "./shell-stack";

jest.mock("expo-router", () => ({ Stack: () => null, useRouter: jest.fn() }));

describe("rootTitleKey", () => {
  it("names a tab root by its route id's segments", () => {
    expect(rootTitleKey("profile")).toBe("mobile/profile");
    expect(rootTitleKey("coach/fighters/index")).toBe("mobile/coach/fighters");
    // SF-89: the gym tabs are rooted at an id-based path.
    expect(rootTitleKey("gyms/[gymId]/pulse")).toBe("mobile/gyms/_gym-id/pulse");
    expect(rootTitleKey("gyms/[gymId]/members/index")).toBe("mobile/gyms/_gym-id/members");
  });
});
