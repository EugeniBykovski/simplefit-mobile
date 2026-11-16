import { useNavigation } from "expo-router";
import { ChevronRight, CircleAlert, Info, type LucideIcon } from "lucide-react-native";
import { useLayoutEffect, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useTranslations } from "use-intl";

import type { Messages } from "@/shared/i18n/messages";
import type { MobileRouteId } from "@/shared/routes/routes";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { Screen } from "@/shared/ui/screen";
import { Spinner } from "@/shared/ui/spinner";
import { Text } from "@/shared/ui/text";

type RouteTitleKey = keyof Messages["routes"]["titles"];

/** Titles the pushed screen after its registry route (the native back button announces it). */
export function useRouteTitle(routeId: MobileRouteId): string {
  const titles = useTranslations("routes.titles");
  const navigation = useNavigation();
  const title = titles(routeId.split(".").join("/") as RouteTitleKey);
  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);
  return title;
}

/** A labelled group of rows (ST1 sections), one card. */
export function SettingsSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      {title === undefined ? null : (
        <Text variant="label" color="faintForeground" accessibilityRole="header" className="px-1">
          {title}
        </Text>
      )}
      <Card compact className="gap-0 py-1">
        {children}
      </Card>
    </View>
  );
}

/**
 * One settings row. With `onPress` it is a link (or a button); without it a
 * fact. A `disabled` row is visible but announced as not available and does
 * nothing.
 */
export function SettingsRow({
  icon,
  label,
  line,
  value,
  onPress,
  role = "link",
  disabled = false,
  last = false,
  testID,
}: {
  icon?: LucideIcon;
  label: string;
  line?: string | undefined;
  value?: string | undefined;
  onPress?: () => void;
  role?: "link" | "button";
  disabled?: boolean;
  last?: boolean;
  testID?: string;
}) {
  const interactive = onPress !== undefined && !disabled;
  const content = (
    <>
      {icon === undefined ? null : (
        <View className="size-9 items-center justify-center rounded-xl bg-muted">
          <Icon icon={icon} size={18} color={disabled ? "faintForeground" : "highlight"} />
        </View>
      )}
      <View className="flex-1 gap-0.5">
        <Text variant="body" weight="extrabold" color={disabled ? "mutedForeground" : "foreground"}>
          {label}
        </Text>
        {line === undefined ? null : (
          <Text variant="caption" color="mutedForeground">
            {line}
          </Text>
        )}
      </View>
      {value === undefined ? null : (
        <Text variant="bodySm" color="mutedForeground" className="max-w-[45%] text-right">
          {value}
        </Text>
      )}
      {interactive ? <Icon icon={ChevronRight} size={16} color="faintForeground" /> : null}
    </>
  );
  const className = `min-h-15 flex-row items-center gap-3 py-2 ${last ? "" : "border-b border-border"}`;
  const label11y = [label, line, value].filter((part) => part !== undefined).join(", ");
  if (onPress === undefined || disabled) {
    return (
      <View
        accessible
        accessibilityLabel={label11y}
        accessibilityState={disabled ? { disabled: true } : undefined}
        className={className}
        testID={testID}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label11y}
      onPress={onPress}
      className={`${className} active:bg-muted`}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

/** A truthful "not available" screen body: what is missing and what that means for the user. */
export function UnavailableSettings({
  title,
  body,
  testID,
}: {
  title: string;
  body: string;
  testID: string;
}) {
  const t = useTranslations("accountSettings");
  return (
    <Screen>
      <View className="gap-3" testID={testID}>
        <Text variant="label" color="faintForeground">
          {t("unavailable")}
        </Text>
        <Text variant="h2" accessibilityRole="header">
          {title}
        </Text>
        <Text color="mutedForeground">{body}</Text>
      </View>
    </Screen>
  );
}

/** Loading, then failure with a retry, for a settings screen that reads the backend. */
export function SettingsLoad({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const t = useTranslations("accountSettings");
  if (!failed) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner label={t("loading")} />
      </View>
    );
  }
  return (
    <Screen>
      <Notice tone="coral" icon={CircleAlert} live>
        {t("loadFailed")}
      </Notice>
      <Button label={t("retry")} variant="quiet" onPress={onRetry} />
    </Screen>
  );
}

/** A short informational note (muted). */
export function SettingsNote({ children }: { children: ReactNode }) {
  return (
    <Notice tone="muted" icon={Info}>
      {children}
    </Notice>
  );
}
