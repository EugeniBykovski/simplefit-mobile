import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { siteConfig } from "@/shared/config/site";
import { useTheme } from "@/shared/styles/theme";

import { Text } from "./text";

/**
 * The SimpleFit brand lockup of the auth screens (Claude Design A01): the
 * "S" mark on its 38 pt olive tile (radius `md`), "SimpleFit" and the sport
 * name in the wide mono label. Decorative for assistive technology: the
 * lockup is announced once, as the brand name.
 */
export function BrandLockup() {
  const { colors } = useTheme();
  const [brand, ...sport] = siteConfig.name.split(" ");

  return (
    <View accessible accessibilityLabel={siteConfig.name} className="flex-row items-center gap-2.5">
      <View className="size-[38px] items-center justify-center rounded-md bg-primary">
        <Svg width={26} height={26} viewBox="13 13 38 38" fill="none">
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
      <View className="gap-1">
        <Text variant="metricSm">{brand}</Text>
        <Text variant="labelWide" color="highlight">
          {sport.join(" ")}
        </Text>
      </View>
    </View>
  );
}
