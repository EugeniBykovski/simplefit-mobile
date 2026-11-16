import { useRouter } from "expo-router";
import {
  Ban,
  Bell,
  CircleAlert,
  Building2,
  CircleHelp,
  Download,
  Lock,
  Plug,
  ShieldCheck,
  SquarePen,
  Timer,
  Trash2,
  UserRound,
} from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useTranslations } from "use-intl";

import { useAccountProfile } from "@/entities/account-profile";
import { emailsOf, useSignInMethods } from "@/entities/sign-in-method";
import { isKnownEntry, useEntry } from "@/features/session-gate";
import { SignOutButton } from "@/features/sign-out";
import { routeHref, type MobileRouteId } from "@/shared/routes/routes";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Notice } from "@/shared/ui/notice";
import { Screen } from "@/shared/ui/screen";
import { Spinner } from "@/shared/ui/spinner";
import { Text } from "@/shared/ui/text";

import { SettingsRow, SettingsSection, useRouteTitle } from "./settings-parts";

const NO_CONTINUATION = {};

/*
 * ST1 · Settings hub (SF-161; Claude Design 1794843261-39f9, Settings.dc.html)
 * on `mobile.settings`, shared by every shell. The identity card shows the
 * account's own name (AccountProfile) and first proven email (sign-in
 * methods), and the contexts the entry reports; never a role field. Every
 * row opens a real screen: one built on the backend's data, or a truthful
 * "not available" screen. Edit profile is the FighterProfile and only
 * appears when the entry reports FIGHTER. Delete account (SF-180) and
 * billing (SF-181) have no screen yet: Delete is a disabled row, billing is
 * the gym memberships list that exists. Sign out ends this device's session
 * (SF-28: the cache is cleared and late answers discarded).
 */
export function SettingsHubScreen() {
  useRouteTitle("mobile.settings");
  const t = useTranslations("accountSettings.hub");
  const common = useTranslations("accountSettings");
  const router = useRouter();
  const profile = useAccountProfile();
  const methods = useSignInMethods();
  const entry = useEntry(NO_CONTINUATION);
  const open = (route: MobileRouteId) => () => router.push(routeHref(route));

  if (profile.data === undefined || methods.data === undefined) {
    // Sign out never waits for (or depends on) the account's data.
    const failed = profile.isError || methods.isError;
    return (
      <Screen>
        <View className="gap-5" testID="settings:hub">
          {failed ? (
            <>
              <Notice tone="coral" icon={CircleAlert} live>
                {common("loadFailed")}
              </Notice>
              <Button
                label={common("retry")}
                variant="quiet"
                onPress={() => {
                  void profile.refetch();
                  void methods.refetch();
                }}
              />
            </>
          ) : (
            <Spinner label={common("loading")} />
          )}
          <SignOutButton />
        </View>
      </Screen>
    );
  }

  const known = entry.data !== undefined && isKnownEntry(entry.data) ? entry.data : undefined;
  const capabilities: readonly string[] = known?.capabilities ?? [];
  const fighter = capabilities.includes("FIGHTER");
  const contexts = [
    ...(fighter ? [t("roles.fighter")] : []),
    ...(capabilities.includes("COACH") ? [t("roles.coach")] : []),
    ...((known?.gym_workspaces.length ?? 0) > 0 ? [t("roles.gym")] : []),
  ];
  const name = profile.data.full_name ?? "";
  const email = emailsOf(methods.data)[0];

  return (
    <Screen>
      <View className="gap-5" testID="settings:hub">
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={[name, email, ...contexts].filter(Boolean).join(", ")}
          accessibilityHint={t("identityHint")}
          onPress={open("mobile.settings.account")}
          className="flex-row items-center gap-3.5 rounded-3xl border border-border bg-surface p-4 active:bg-muted"
        >
          <Avatar name={name} size="lg" />
          <View className="flex-1 gap-1">
            <Text variant="bodyLg" weight="extrabold" numberOfLines={2}>
              {name}
            </Text>
            {email === undefined ? null : (
              <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                {email}
              </Text>
            )}
            {contexts.length === 0 ? null : (
              <View className="flex-row flex-wrap gap-1.5 pt-1">
                {contexts.map((context) => (
                  <Badge key={context} label={context} />
                ))}
              </View>
            )}
          </View>
        </Pressable>

        <SettingsSection title={t("sections.account")}>
          <SettingsRow
            icon={UserRound}
            label={t("rows.account.label")}
            line={t("rows.account.line")}
            onPress={open("mobile.settings.account")}
          />
          <SettingsRow
            icon={ShieldCheck}
            label={t("rows.security.label")}
            line={t("rows.security.line")}
            onPress={open("mobile.settings.security")}
            last={!fighter}
          />
          {fighter ? (
            <SettingsRow
              icon={SquarePen}
              label={t("rows.profile.label")}
              line={t("rows.profile.line")}
              onPress={open("mobile.settings.profile")}
              last
            />
          ) : null}
        </SettingsSection>

        <SettingsSection title={t("sections.privacy")}>
          <SettingsRow
            icon={Lock}
            label={t("rows.privacy.label")}
            line={t("rows.privacy.line")}
            onPress={open("mobile.settings.privacy")}
          />
          <SettingsRow
            icon={Ban}
            label={t("rows.blocked.label")}
            line={t("rows.blocked.line")}
            onPress={open("mobile.settings.blocked")}
          />
          <SettingsRow
            icon={Bell}
            label={t("rows.notifications.label")}
            line={t("rows.notifications.line")}
            onPress={open("mobile.settings.notifications")}
            last
          />
        </SettingsSection>

        <SettingsSection title={t("sections.training")}>
          <SettingsRow
            icon={Timer}
            label={t("rows.training.label")}
            line={t("rows.training.line")}
            onPress={open("mobile.settings.training")}
          />
          <SettingsRow
            icon={Plug}
            label={t("rows.apps.label")}
            line={t("rows.apps.line")}
            onPress={open("mobile.settings.apps")}
            last
          />
        </SettingsSection>

        <SettingsSection title={t("sections.more")}>
          <SettingsRow
            icon={Building2}
            label={t("rows.memberships.label")}
            line={t("rows.memberships.line")}
            onPress={open("mobile.me.gyms")}
          />
          <SettingsRow
            icon={Download}
            label={t("rows.data.label")}
            line={t("rows.data.line")}
            onPress={open("mobile.settings.data")}
          />
          <SettingsRow
            icon={CircleHelp}
            label={t("rows.help.label")}
            line={t("rows.help.line")}
            onPress={open("mobile.settings.help")}
            last
          />
        </SettingsSection>

        <SettingsSection>
          <SettingsRow
            icon={Trash2}
            label={t("rows.delete.label")}
            line={t("rows.delete.line")}
            disabled
            last
            testID="settings:delete"
          />
        </SettingsSection>

        <SignOutButton />
      </View>
    </Screen>
  );
}
