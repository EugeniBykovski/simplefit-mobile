import { useNavigation } from "expo-router";
import { useLayoutEffect } from "react";
import { useTranslations } from "use-intl";

import type { Messages } from "@/shared/i18n/messages";

/** Names the native header of a pushed sessions screen after its registry route. */
export function useScreenTitle(route: keyof Messages["routes"]["titles"]) {
  const navigation = useNavigation();
  const title = useTranslations("routes.titles")(route);
  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);
}
