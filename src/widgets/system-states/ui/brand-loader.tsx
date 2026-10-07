import { Animated, Easing, View } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import { siteConfig } from "@/shared/config/site";
import { useLoop } from "@/shared/lib/loop";
import { useReducedMotion } from "@/shared/lib/reduced-motion";
import { useTheme } from "@/shared/styles/theme";
import { Text } from "@/shared/ui/text";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const POSTS: [number, number, number][] = [
  [10.1, 10.1, 0],
  [53.9, 10.1, 400],
  [53.9, 53.9, 800],
  [10.1, 53.9, 1200],
];

/**
 * The animated SimpleFit mark of LD1 (Claude Design section 35): a spinning
 * ring, a glowing ring box whose corner posts pulse in turn, the drawn "S"
 * and the wordmark. Decorative: the launch screen carries the accessible
 * status. Everything rests static when the system reduces motion.
 */
export function BrandLoader() {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const running = !reduced;
  const spin = useLoop({ duration: 1100, running });
  const glow = useLoop({ duration: 2400, running, rest: 0.5, easing: Easing.inOut(Easing.ease) });
  const draw = useLoop({
    duration: 2400,
    running,
    rest: 1,
    nativeDriver: false,
    easing: Easing.inOut(Easing.ease),
  });
  const [brand, ...sport] = siteConfig.name.split(" ");

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="items-center gap-5.5"
    >
      <View className="size-[190px] items-center justify-center">
        <Animated.View
          className="absolute inset-0"
          // Runtime transform: the ring turns once every 1.1 s.
          style={{
            transform: [
              { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) },
            ],
          }}
        >
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Circle cx="50" cy="50" r="47" fill="none" stroke={colors.border} strokeWidth={1.6} />
            <Circle
              cx="50"
              cy="50"
              r="47"
              fill="none"
              stroke={colors.highlight}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeDasharray="46 250"
            />
          </Svg>
        </Animated.View>
        <Animated.View
          className="absolute size-[120px]"
          // Runtime opacity: the halo breathes between 55 % and 100 %.
          style={{
            opacity: glow.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 1, 0.55] }),
          }}
        >
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={colors.primary} stopOpacity={0.22} />
                <Stop offset="0.7" stopColor={colors.primary} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#halo)" />
          </Svg>
        </Animated.View>
        <Svg width={120} height={120} viewBox="0 0 64 64" fill="none">
          <Rect
            x="6"
            y="6"
            width="52"
            height="52"
            rx="14"
            stroke={colors.foreground}
            strokeWidth={3.5}
          />
          {POSTS.map(([cx, cy, delay]) => (
            <Post
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              delay={delay}
              running={running}
              color={colors.highlight}
            />
          ))}
          <AnimatedPath
            d="M44 20H26a6 6 0 0 0 0 12h12a6 6 0 0 1 0 12H29"
            stroke={colors.highlight}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="120"
            strokeDashoffset={draw.interpolate({
              inputRange: [0, 0.55, 1],
              outputRange: [120, 0, 0],
            })}
          />
          <Circle cx="44" cy="20" r="5.5" fill={colors.highlight} />
          <Circle cx="20" cy="44" r="4.6" stroke={colors.accentForeground} strokeWidth={2.8} />
        </Svg>
      </View>
      <View className="items-center gap-2">
        <Text variant="wordmark">{brand}</Text>
        <Text variant="labelWide" color="highlight" className="pl-1.5">
          {sport.join(" ")}
        </Text>
      </View>
    </View>
  );
}

/** One corner post: fades and grows in turn with the others (1.6 s cycle). */
function Post({
  cx,
  cy,
  delay,
  running,
  color,
}: {
  cx: number;
  cy: number;
  delay: number;
  running: boolean;
  color: string;
}) {
  const pulse = useLoop({
    duration: 1600,
    running,
    rest: 0.4,
    delay,
    nativeDriver: false,
    easing: Easing.inOut(Easing.ease),
  });
  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={pulse.interpolate({ inputRange: [0, 0.4, 1], outputRange: [2.55, 3.91, 2.55] })}
      fill={color}
      opacity={pulse.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.22, 1, 0.22] })}
    />
  );
}
