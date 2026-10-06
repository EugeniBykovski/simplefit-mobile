import { usePathname, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";

import type { Messages } from "@/shared/i18n/messages";
import { matchMobileRoute, mobileShell, navKeyForRoute, routeHref } from "@/shared/routes/routes";
import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";

import { tabNavigation, type TabShell } from "../model/navigation";

type ShellMessageKey = {
  [S in TabShell]: `${S}.${Extract<keyof Messages["shells"][S], string>}`;
}[TabShell];

/**
 * The floating tab bar of a role shell (FighterTabs, CoachTabs, GymTabs).
 * Items and targets are the registry's `navItems`; the active item is the
 * one that owns the current route (the route itself or its nearest
 * ancestor). An item whose route lives in another shell (the coach Inbox
 * opens the shared /messages) is pushed above the tabs.
 */
export function ShellTabBar({ shell }: { shell: TabShell }) {
  const t = useTranslations("shells");
  const label = (key: string) => t(`${shell}.${key}` as ShellMessageKey);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const config = tabNavigation[shell];
  const active = navKeyForRoute(config.shell, matchMobileRoute(pathname)?.id);

  return (
    <View
      className="bg-background px-4 pt-2"
      // Runtime safe-area inset; the bar floats above the home indicator.
      style={{ paddingBottom: Math.max(insets.bottom, 16) }}
    >
      <View
        accessibilityRole="tablist"
        accessibilityLabel={label("label")}
        className="flex-row items-center justify-between rounded-full border border-border-strong bg-surface-elevated px-2 py-2.5"
      >
        {mobileShell(config.shell).navItems.map((item) => {
          const selected = item.key === active;
          const icon = config.icons[item.key];
          if (!icon) throw new Error(`No tab icon for ${config.shell}#${item.key}`);
          const center = item.key === config.center;

          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityLabel={label(item.key)}
              accessibilityState={{ selected }}
              onPress={() => router.navigate(routeHref(item.route))}
              className={
                center
                  ? `h-14 w-14 items-center justify-center rounded-full ${selected ? "bg-highlight" : "bg-primary"}`
                  : selected
                    ? "h-12 flex-row items-center gap-1.5 rounded-full bg-primary px-3"
                    : "h-12 w-12 items-center justify-center rounded-full"
              }
            >
              <Icon
                icon={icon}
                size={center ? 24 : selected ? 20 : 22}
                color={center || selected ? "primaryForeground" : "mutedForeground"}
              />
              {selected && !center ? (
                <Text variant="bodySm" weight="extrabold" color="primaryForeground">
                  {label(item.key)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
