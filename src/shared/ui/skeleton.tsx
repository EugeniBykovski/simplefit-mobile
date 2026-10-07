import { Animated, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { useLoop } from "@/shared/lib/loop";
import { useReducedMotion } from "@/shared/lib/reduced-motion";
import { useTheme } from "@/shared/styles/theme";

const SWEEP = 280;

/**
 * Placeholder block shown while content loads (> 300 ms waits). Hidden from
 * assistive technology; pair it with a labelled Spinner or live-region text
 * describing what is loading.
 *
 * - `motion="static"` (default): the SF-13 block, no animation.
 * - `motion="shimmer"`: the sweep of the Claude Design loading artboards
 *   (LD2, SF-34), a 280 pt highlight crossing the block every 1.5 s.
 * - `tone="accent"`: the olive variant for content on accent surfaces.
 *
 * The shimmer rests static when the system asks to reduce motion.
 */
export function Skeleton({
  className,
  tone = "neutral",
  motion = "static",
}: {
  className?: string;
  tone?: "neutral" | "accent";
  motion?: "static" | "shimmer";
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const shimmer = motion === "shimmer" && !reduced;
  const progress = useLoop({ duration: 1500, running: shimmer });
  const highlight = tone === "accent" ? colors.accentStrong : colors.border;

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className={`overflow-hidden rounded-md ${tone === "accent" ? "bg-accent" : "bg-muted"} ${className ?? ""}`}
    >
      {shimmer ? (
        <Animated.View
          pointerEvents="none"
          className="absolute inset-y-0"
          // Runtime transform: the highlight band sweeps across the block.
          style={{
            width: SWEEP,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-SWEEP, 460],
                }),
              },
            ],
          }}
        >
          <Svg width={SWEEP} height="100%">
            <Defs>
              <LinearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={highlight} stopOpacity={0} />
                <Stop offset="0.5" stopColor={highlight} stopOpacity={1} />
                <Stop offset="1" stopColor={highlight} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width={SWEEP} height="100%" fill="url(#sweep)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
