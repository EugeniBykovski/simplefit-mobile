import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets, type Edge } from "react-native-safe-area-context";

/**
 * Base frame for a screen: themed background, safe-area insets and optional
 * scrolling. Deliberately small; compose rather than extend it:
 *
 * - Screens under the navigation header use the default edges (the header
 *   already handles the top inset). Header-less screens pass edges with "top".
 * - Forms wrap their content in KeyboardAvoidingView (behavior "padding" on
 *   iOS) inside a scrolling Screen.
 * - Long or data-driven lists use a virtualized list (FlashList when it is
 *   introduced) as the screen body instead of `scroll`.
 *
 * Insets are runtime values, so they are the only thing passed via `style`.
 */
export function Screen({
  children,
  scroll = true,
  edges = ["bottom", "left", "right"],
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
}) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: edges.includes("top") ? insets.top : 0,
    paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
    paddingLeft: edges.includes("left") ? insets.left : 0,
    paddingRight: edges.includes("right") ? insets.right : 0,
  };

  return (
    <View className="flex-1 bg-background" style={padding}>
      {scroll ? (
        <ScrollView
          contentContainerClassName="gap-6 p-4"
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1 gap-6 p-4">{children}</View>
      )}
    </View>
  );
}
