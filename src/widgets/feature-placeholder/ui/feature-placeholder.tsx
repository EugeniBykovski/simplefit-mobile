import { useNavigation } from "expo-router";
import { useLayoutEffect } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import type { Messages } from "@/shared/i18n/messages";
import { isTabRoute, mobileRoute, type MobileRouteId } from "@/shared/routes/routes";
import { Badge } from "@/shared/ui/badge";
import { Screen } from "@/shared/ui/screen";
import { Text } from "@/shared/ui/text";

type RouteTitleKey = keyof Messages["routes"]["titles"];

/** Message key of a route title: `mobile.camp.weight` -> `mobile/camp/weight` (use-intl nests on "."). */
export const routeTitleKey = (id: MobileRouteId) => id.split(".").join("/") as RouteTitleKey;

/**
 * The one canonical placeholder for SF-31 routes whose feature screen is
 * built by a later ticket (SF-33, route-architecture §14). It renders inside
 * the route's shell and shows the route name, a "Planned" status and the
 * canonical path: no data, no controls, no API calls, nothing that pretends
 * to be the product. Replace the route file with the real screen; never fork
 * this component per route.
 */
export function FeaturePlaceholder({ routeId }: { routeId: MobileRouteId }) {
  const t = useTranslations("shells.placeholder");
  const titles = useTranslations("routes.titles");
  const navigation = useNavigation();
  const title = titles(routeTitleKey(routeId));
  // Tabs have no header (the tab bar is the navigation); pushed screens title theirs.
  const tab = isTabRoute(routeId);

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  return (
    <Screen edges={tab ? ["top", "left", "right"] : undefined}>
      <View className="gap-4 pt-2" testID={`feature-placeholder:${routeId}`}>
        <Badge label={t("badge")} />
        <Text variant="h1">{title}</Text>
        <Text color="mutedForeground">{t("description")}</Text>
        <View
          className="flex-row flex-wrap gap-2"
          accessible
          accessibilityLabel={`${t("route")}: ${mobileRoute(routeId).path}`}
        >
          <Text variant="caption" color="faintForeground">
            {t("route")}
          </Text>
          <Text variant="caption" color="faintForeground" weight="bold">
            {mobileRoute(routeId).path}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

/**
 * The default export of a placeholder route file:
 * `export default placeholderRoute("mobile.camp");`
 */
export function placeholderRoute(routeId: MobileRouteId) {
  function PlaceholderRoute() {
    return <FeaturePlaceholder routeId={routeId} />;
  }
  PlaceholderRoute.displayName = `PlaceholderRoute(${routeId})`;
  return PlaceholderRoute;
}
