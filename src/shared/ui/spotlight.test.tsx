import { placeCard } from "./spotlight";

const screen = { width: 390, height: 844 };
const insets = { top: 47, bottom: 34 };

describe("placeCard (SF-41 coach marks)", () => {
  it("puts the card below a target near the top, the arrow at the target's centre", () => {
    const place = placeCard({ x: 270, y: 54, width: 52, height: 52 }, 190, screen, insets);
    expect(place.side).toBe("below");
    expect(place.top).toBe(54 + 52 + 13);
    expect(place.arrowLeft).toBe(270 + 26 - 8);
  });

  it("puts the card above a target near the bottom (the tab bar)", () => {
    const place = placeCard({ x: 165, y: 760, width: 64, height: 64 }, 190, screen, insets);
    expect(place.side).toBe("above");
    expect(place.top).toBe(760 - 13 - 190);
  });

  it("keeps the card on screen when neither side has room (a tall target on a small phone)", () => {
    const small = { width: 375, height: 667 };
    const place = placeCard({ x: 14, y: 200, width: 347, height: 400 }, 220, small, insets);
    expect(place.top).toBeGreaterThanOrEqual(insets.top + 8);
    expect(place.top + 220).toBeLessThanOrEqual(small.height - insets.bottom - 8);
  });

  it("keeps the arrow inside the card's rounded corners", () => {
    const place = placeCard({ x: 0, y: 54, width: 20, height: 52 }, 190, screen, insets);
    expect(place.arrowLeft).toBe(20 + 18);
  });
});
