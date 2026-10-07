import { View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * The radial glow behind the launch and 404 states (Claude Design LD1/ER1):
 * `accent` fading into the background, centred at `cy`. Decorative.
 */
export function SystemGlow({ color, cy }: { color: string; cy: string }) {
  return (
    <View pointerEvents="none" className="absolute inset-0">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="system-glow" cx="50%" cy={cy} r="62%">
            <Stop offset="0" stopColor={color} stopOpacity={0.7} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#system-glow)" />
      </Svg>
    </View>
  );
}
