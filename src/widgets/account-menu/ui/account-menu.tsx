import { useNavigation, useRouter } from "expo-router";
import {
  ArrowLeftRight,
  Building2,
  ChevronRight,
  CircleAlert,
  Settings,
  UsersRound,
  type LucideIcon,
} from "lucide-react-native";
import { useLayoutEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";

import { useFighterProfile, type FighterProfile } from "@/entities/fighter-profile";
import { ContextSwitcherSheet } from "@/features/session-gate";
import { SignOutButton } from "@/features/sign-out";
import { routeHref, type MobileRouteId } from "@/shared/routes/routes";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { Screen } from "@/shared/ui/screen";
import { Spinner } from "@/shared/ui/spinner";
import { Text } from "@/shared/ui/text";

/*
 * The smallest real way into the account from the Fighter app (SF-28):
 * Claude Design F18 (Profile) links "Settings · account · privacy" to ST1
 * (Settings hub), whose last action is Sign out. SF-59 adds F18's Coaches
 * row (Claude Design 1792069267-b198): the fighter's real coaching
 * relationships (FC1).
 *
 * SF-160 (Claude Design 1794841517-868f, F18): the Profile tab shows the
 * fighter's own FighterProfile (name, handle, stance and weight class, which
 * only its owner ever sees) and only the F18 rows whose destination exists:
 * Coaches (FC1), Gyms (My gyms, MMG1), Switch workspace (A04) and Settings
 * (ST1). The record, friends, Go Pro, progress, fight camps, sparring,
 * payments, emergency contact and privacy rows belong to domains that do not
 * exist yet and are not shown; nothing is counted or invented.
 */

/** F18 on the Profile tab (`mobile.profile`). */
export function ProfileScreen() {
  const t = useTranslations("accountMenu");
  const profile = useFighterProfile();

  if (profile.isError) {
    return (
      <Screen edges={["top", "left", "right"]}>
        <View className="flex-1 justify-center gap-3" testID="account-menu:profile">
          <Notice tone="coral" icon={CircleAlert}>
            {t("profile.loadFailed")}
          </Notice>
          <Button
            label={t("profile.retry")}
            variant="quiet"
            onPress={() => void profile.refetch()}
          />
          <ProfileLinks />
        </View>
      </Screen>
    );
  }
  if (profile.data === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner label={t("profile.loading")} />
      </View>
    );
  }
  return <ProfileView profile={profile.data} />;
}

function ProfileView({ profile }: { profile: FighterProfile }) {
  const t = useTranslations("accountMenu");
  const onboarding = useTranslations("fighterOnboarding");
  const insets = useSafeAreaInsets();
  const name = profile.display_name ?? "";
  const stance =
    profile.stance === null ? null : onboarding(`experience.stances.${profile.stance}`);
  const weightClass =
    profile.weight_class === null ? null : onboarding(`weight.classes.${profile.weight_class}`);

  return (
    // Runtime inset: content scrolls below the status bar, never under it.
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerClassName="gap-3.5 px-5 pb-6 pt-3" testID="account-menu:profile">
        <View className="flex-row items-center gap-3.5">
          <Avatar name={name} size="lg" />
          <View className="flex-1 gap-1">
            <Text variant="title" accessibilityRole="header" numberOfLines={2}>
              {name}
            </Text>
            <Text variant="bodySm" color="mutedForeground" numberOfLines={1}>
              {profile.username === null
                ? t("profile.identity")
                : t("profile.identityWithHandle", { username: profile.username })}
            </Text>
          </View>
        </View>

        {stance === null && weightClass === null ? null : (
          <View className="flex-row gap-2">
            {stance === null ? null : <Fact label={t("profile.stance")} value={stance} />}
            {weightClass === null ? null : (
              <Fact label={t("profile.weightClass")} value={weightClass} />
            )}
          </View>
        )}

        <ProfileLinks />
      </ScrollView>
    </View>
  );
}

/** A fact of the fighter's own profile (F18's stat tiles), read from FighterProfile only. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="flex-1 gap-1 rounded-2xl border border-border bg-surface p-2.5"
    >
      <Text variant="label" color="faintForeground">
        {label}
      </Text>
      <Text variant="bodySm" weight="extrabold">
        {value}
      </Text>
    </View>
  );
}

/** F18's rows whose destination exists, then Settings (ST1). */
function ProfileLinks() {
  const t = useTranslations("accountMenu");
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  return (
    <>
      <Card compact className="gap-0 py-1">
        <LinkRow icon={UsersRound} label={t("coachesLink")} route="mobile.profile.coaches" />
        <LinkRow icon={Building2} label={t("profile.gymsLink")} route="mobile.me.gyms" />
        <Row
          icon={ArrowLeftRight}
          label={t("profile.switchWorkspace")}
          role="button"
          onPress={() => setSwitching(true)}
          last
        />
      </Card>
      <Button
        label={t("settingsLink")}
        variant="quiet"
        icon={Settings}
        onPress={() => router.push(routeHref("mobile.settings"))}
      />
      <ContextSwitcherSheet
        visible={switching}
        current="fighter"
        onClose={() => setSwitching(false)}
      />
    </>
  );
}

function LinkRow({
  icon,
  label,
  route,
}: {
  icon: LucideIcon;
  label: string;
  route: MobileRouteId;
}) {
  const router = useRouter();
  return (
    <Row icon={icon} label={label} role="link" onPress={() => router.push(routeHref(route))} />
  );
}

function Row({
  icon,
  label,
  role,
  onPress,
  last = false,
}: {
  icon: LucideIcon;
  label: string;
  role: "link" | "button";
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      onPress={onPress}
      className={`min-h-13 flex-row items-center gap-3 active:bg-muted ${last ? "" : "border-b border-border"}`}
    >
      <Icon icon={icon} size={20} color="highlight" />
      <Text variant="body" weight="bold" className="flex-1">
        {label}
      </Text>
      <Icon icon={ChevronRight} size={16} color="faintForeground" />
    </Pressable>
  );
}

/** ST1's Sign out, on the Settings route (`mobile.settings`). */
export function SettingsScreen() {
  const t = useTranslations("accountMenu");
  const titles = useTranslations("routes.titles");
  const navigation = useNavigation();
  const title = titles("mobile/settings");

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  return (
    <Screen>
      <View className="gap-4 pt-2" testID="account-menu:settings">
        <Text color="mutedForeground">{t("settingsNote")}</Text>
        <SignOutButton />
      </View>
    </Screen>
  );
}
