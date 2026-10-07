import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * The system "Reduce Motion" setting (iOS) / "Remove animations" (Android).
 * Animated system states (SF-34) stop and keep their static layout when it
 * is on. Starts as `false` until the setting is read.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
