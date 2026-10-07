import { Children, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Text, type TextColor } from "./text";

/**
 * A line of copy with inline text actions ("Wrong email? Use a different
 * email"), from a rich message: `t.rich(key, { link: linkTo(onPress) })`.
 * Each action is a separate 44 pt touch target (nested Text presses are too
 * small), so the line wraps as a row instead of one Text.
 */
export function TextLinks({
  children,
  color = "faintForeground",
  center = false,
}: {
  children: ReactNode;
  color?: TextColor;
  center?: boolean;
}) {
  return (
    <View className={`flex-row flex-wrap items-center gap-x-1 ${center ? "justify-center" : ""}`}>
      {Children.toArray(children).map((part, index) =>
        typeof part === "string" || typeof part === "number" ? (
          String(part).trim() === "" ? null : (
            <Text key={index} variant="bodySm" color={color}>
              {String(part).trim()}
            </Text>
          )
        ) : (
          part
        ),
      )}
    </View>
  );
}

/** The rich-message tag renderer of an inline action (highlight olive, 800, 44 pt target). */
export const linkTo = (onPress: () => void) =>
  function InlineLink(chunks: ReactNode) {
    return (
      <Pressable accessibilityRole="link" onPress={onPress} className="min-h-touch justify-center">
        <Text variant="bodySm" weight="extrabold" color="highlight">
          {chunks}
        </Text>
      </Pressable>
    );
  };
