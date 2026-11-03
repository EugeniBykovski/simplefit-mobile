import { useNavigation } from "expo-router";
import { useLayoutEffect, type ReactNode } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import type { Messages } from "@/shared/i18n/messages";
import { Text } from "@/shared/ui/text";

/** Names the native header of a member screen after its registry route. */
export function useScreenTitle(route: keyof Messages["routes"]["titles"]) {
  const navigation = useNavigation();
  const title = useTranslations("routes.titles")(route);
  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);
}

/** An honest state of a member screen (no membership, a pending request, an ended one). */
export function MemberState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View className="gap-3 rounded-3xl border border-dashed border-border px-5 py-6">
      <Text variant="h3" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="bodySm" color="mutedForeground">
        {body}
      </Text>
      {action}
    </View>
  );
}
