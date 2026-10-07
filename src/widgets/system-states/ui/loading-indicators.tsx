import { Animated, Easing, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { useLoop } from "@/shared/lib/loop";
import { useReducedMotion } from "@/shared/lib/reduced-motion";
import { useTheme } from "@/shared/styles/theme";
import { Text } from "@/shared/ui/text";

/**
 * Indeterminate segmented progress of LD1: the design's segments, lit in
 * turn. The app has no discrete bootstrap steps, so no step count is shown
 * (SF-34 decision 1). Static when the system reduces motion.
 */
export function LoadingSegments({ count }: { count: number }) {
  const reduced = useReducedMotion();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="w-full flex-row gap-1"
    >
      {Array.from({ length: count }, (_, index) => (
        <Segment key={index} delay={(index * 1400) / count} running={!reduced} />
      ))}
    </View>
  );
}

function Segment({ delay, running }: { delay: number; running: boolean }) {
  const pulse = useLoop({ duration: 1400, running, delay, easing: Easing.inOut(Easing.ease) });
  return (
    <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-input">
      <Animated.View
        className="absolute inset-0 bg-primary"
        // Runtime opacity: each segment lights up in turn.
        style={{ opacity: pulse.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 1, 0] }) }}
      />
    </View>
  );
}

/** The 3 pt running bar of the loading artboards (LD2 top edge). */
export function LoadingBar() {
  const reduced = useReducedMotion();
  const run = useLoop({ duration: 1300, running: !reduced, easing: Easing.bezier(0.4, 0, 0.2, 1) });
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="h-[3px] w-full overflow-hidden bg-surface-subtle"
    >
      <Animated.View
        className="h-[3px] w-1/4 rounded-full bg-highlight"
        // Runtime transform: the bar runs across the edge.
        style={{
          transform: [
            { translateX: run.interpolate({ inputRange: [0, 1], outputRange: [-120, 420] }) },
          ],
        }}
      />
    </View>
  );
}

/** The olive status pill with a small spinner (LD2). */
export function LoadingPill({ label }: { label: string }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const spin = useLoop({ duration: 1100, running: !reduced });
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      className="h-[30px] flex-row items-center gap-2 self-start rounded-full border border-accent-border bg-accent px-3"
    >
      <Animated.View
        // Runtime transform: the spinner turns.
        style={{
          transform: [
            { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) },
          ],
        }}
      >
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke={colors.accentBorder} strokeWidth={3} />
          <Path
            d="M21 12a9 9 0 0 0-9-9"
            stroke={colors.highlight}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
      <Text variant="micro" weight="extrabold" color="accentForeground">
        {label}
      </Text>
    </View>
  );
}
