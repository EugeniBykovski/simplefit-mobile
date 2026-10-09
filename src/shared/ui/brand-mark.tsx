import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { siteConfig } from "@/shared/config/site";
import { useTheme } from "@/shared/styles/theme";

import { Text } from "./text";

/**
 * The "S" mark on its olive tile: 38 pt (radius `md`) in the auth lockup,
 * 32 pt (radius `sm`; the artboard draws 30) in the Fighter first-run header (SF-41). Decorative:
 * the screen names the brand in text.
 */
export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const { colors } = useTheme();
  const glyph = size === "sm" ? 21 : 26;
  return (
    <View
      className={`items-center justify-center bg-primary ${size === "sm" ? "size-8 rounded-sm" : "size-[38px] rounded-md"}`}
    >
      <Svg width={glyph} height={glyph} viewBox="13 13 38 38" fill="none">
        <Path
          d="M44 20H26a6 6 0 0 0 0 12h12a6 6 0 0 1 0 12H29"
          stroke={colors.primaryForeground}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={44} cy={20} r={5.5} fill={colors.primaryForeground} />
        <Circle cx={20} cy={44} r={4.6} stroke={colors.primaryForeground} strokeWidth={2.8} />
      </Svg>
    </View>
  );
}

/**
 * The SimpleFit brand lockup of the auth screens (Claude Design A01): the
 * "S" mark on its 38 pt olive tile (radius `md`), "SimpleFit" and the sport
 * name in the wide mono label. Decorative for assistive technology: the
 * lockup is announced once, as the brand name.
 */
export function BrandLockup() {
  const [brand, ...sport] = siteConfig.name.split(" ");

  return (
    <View accessible accessibilityLabel={siteConfig.name} className="flex-row items-center gap-2.5">
      <BrandMark />
      <View className="gap-1">
        <Text variant="metricSm">{brand}</Text>
        <Text variant="labelWide" color="highlight">
          {sport.join(" ")}
        </Text>
      </View>
    </View>
  );
}
