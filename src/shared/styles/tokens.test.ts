import { palettes, rawPalette, themeVariables, tokenCssName, type SemanticColors } from "./tokens";

// tailwind.config.js is plain Node config; it exports its semantic colour names.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwindConfig = require("../../../tailwind.config.js");

const tokens = Object.keys(palettes.dark) as (keyof SemanticColors)[];

/** WCAG 2.x relative luminance contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// Text/background pairs components actually render.
const textPairs: [keyof SemanticColors, keyof SemanticColors][] = [
  ["foreground", "background"],
  ["mutedForeground", "background"],
  ["surfaceForeground", "surface"],
  ["mutedForeground", "surface"],
  ["foreground", "surfaceElevated"],
  ["mutedForeground", "muted"],
  ["primaryForeground", "primary"],
  ["primary", "background"],
  ["secondaryForeground", "secondary"],
  ["accentForeground", "accent"],
  ["destructiveForeground", "destructive"],
  ["destructive", "background"],
  ["destructiveSubtleForeground", "destructiveSubtle"],
  ["successForeground", "success"],
  ["successSubtleForeground", "successSubtle"],
  ["warningForeground", "warning"],
  ["warningSubtleForeground", "warningSubtle"],
  ["infoForeground", "info"],
  ["infoSubtleForeground", "infoSubtle"],
];

describe("design tokens", () => {
  it("defines the shared semantic token contract in both themes", () => {
    expect(tokens).toEqual(
      expect.arrayContaining([
        "background",
        "foreground",
        "surface",
        "surfaceSubtle",
        "surfaceElevated",
        "muted",
        "mutedForeground",
        "border",
        "input",
        "ring",
        "primary",
        "primaryForeground",
        "secondary",
        "secondaryForeground",
        "destructive",
        "destructiveForeground",
        "success",
        "successForeground",
        "warning",
        "warningForeground",
        "info",
        "infoForeground",
      ]),
    );
    expect(Object.keys(palettes.light)).toEqual(tokens);
  });

  it.each(["dark", "light"] as const)("meets WCAG AA text contrast in the %s theme", (scheme) => {
    const colors = palettes[scheme];
    const failing = textPairs
      .map(
        ([text, surface]) =>
          `${text}/${surface} ${contrast(colors[text], colors[surface]).toFixed(2)}`,
      )
      .filter((entry) => Number(entry.split(" ")[1]) < 4.5);
    expect(failing).toEqual([]);
    // Focus indicators and control boundaries: 3:1 (WCAG 1.4.11).
    expect(contrast(colors.ring, colors.background)).toBeGreaterThanOrEqual(3);
  });

  it("keeps the canonical Graphite × Olive values shared with the web", () => {
    expect(rawPalette).toMatchObject({
      graphite950: "#111312",
      graphite900: "#181b19",
      bone: "#edefe7",
      olive400: "#aeb95a",
      olive300: "#c9d17e",
      amber: "#e2a250",
      coral: "#df7a5e",
    });
    expect(palettes.dark.background).toBe(rawPalette.graphite950);
    expect(palettes.dark.primary).toBe(rawPalette.olive400);
  });

  it("exposes exactly the semantic tokens as Tailwind colours (no default palette)", () => {
    expect([...tailwindConfig.semanticColors].sort()).toEqual(tokens.map(tokenCssName).sort());
    const colors = tailwindConfig.theme.colors;
    expect(Object.keys(colors).sort()).toEqual(
      ["transparent", ...tailwindConfig.semanticColors].sort(),
    );
    for (const name of tailwindConfig.semanticColors) {
      expect(colors[name]).toBe(`rgb(var(--color-${name}) / <alpha-value>)`);
    }
  });

  it("defines touch target, radius and type scale utilities", () => {
    const { extend } = tailwindConfig.theme;
    expect(extend.minHeight).toEqual({ touch: "44px", "touch-gym": "60px" });
    expect(extend.borderRadius.xl).toBe("22px");
    expect(Object.keys(extend.fontSize)).toEqual([
      "display",
      "h1",
      "h2",
      "h3",
      "title",
      "body",
      "body-sm",
      "label",
      "caption",
    ]);
  });

  it("uses hex colours so they convert to CSS variable channels", () => {
    for (const scheme of ["light", "dark"] as const) {
      for (const value of Object.values(palettes[scheme])) expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(tokenCssName("surfaceElevated")).toBe("surface-elevated");
    expect(themeVariables("dark")).toBeDefined();
  });
});
