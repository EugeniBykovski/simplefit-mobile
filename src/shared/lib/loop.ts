import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";

/**
 * A 0 → 1 value that repeats every `duration` ms (Animated, no extra
 * dependency) while `running`; it rests at `rest` otherwise (reduced motion).
 * `nativeDriver` is false for values that drive SVG props.
 */
export function useLoop({
  duration,
  running,
  rest = 0,
  delay = 0,
  nativeDriver = true,
  easing = Easing.linear,
}: {
  duration: number;
  running: boolean;
  rest?: number;
  delay?: number;
  nativeDriver?: boolean;
  easing?: (value: number) => number;
}): Animated.Value {
  const [value] = useState(() => new Animated.Value(rest));

  useEffect(() => {
    if (!running) {
      value.setValue(rest);
      return;
    }
    value.setValue(0);
    // The delay only offsets the first cycle, so staggered loops keep their phase.
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(
        Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: nativeDriver }),
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [value, duration, running, rest, delay, nativeDriver, easing]);

  return value;
}
