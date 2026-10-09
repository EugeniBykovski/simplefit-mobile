import { dayWithSimpleFit, headerDate } from "./home-date";

describe("Fighter home date", () => {
  it("counts the day with SimpleFit from onboarding completion, day 1 on that day", () => {
    const now = new Date(2026, 9, 9, 18, 0);
    expect(dayWithSimpleFit(new Date(2026, 9, 9, 8, 0).toISOString(), now)).toBe(1);
    expect(dayWithSimpleFit(new Date(2026, 9, 7, 23, 0).toISOString(), now)).toBe(3);
    expect(dayWithSimpleFit(null, now)).toBeUndefined();
    expect(dayWithSimpleFit("garbage", now)).toBeUndefined();
    // A clock behind the server never shows day 0.
    expect(dayWithSimpleFit(new Date(2026, 9, 10).toISOString(), now)).toBe(1);
  });

  it("names the day in the locale's words", () => {
    expect(headerDate("en", new Date(2026, 9, 3))).toBe("Sat · Oct 3");
  });
});
