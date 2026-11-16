import { CircleAlert } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { useAccountProfile, useAccountProfileActions } from "@/entities/account-profile";
import { Card } from "@/shared/ui/card";
import { Notice } from "@/shared/ui/notice";
import { Screen } from "@/shared/ui/screen";
import { Switch } from "@/shared/ui/switch";
import { Text } from "@/shared/ui/text";

import { SettingsLoad, SettingsNote, useRouteTitle } from "./settings-parts";

/*
 * S18 · Notifications (SF-161; NotifSettings.dc.html) on
 * `mobile.settings.notifications`. The only notification preference the
 * backend stores is the product news email consent (ADR 0016, append-only
 * consent history): read from and saved to the AccountProfile, never
 * optimistically; the switch shows the backend's answer. There is no push
 * delivery and no category, channel, digest or quiet-hours preference yet
 * (SF-167), so none is offered (D-SF161-06). Account emails (codes,
 * invitations) are not optional.
 */
export function NotificationsScreen() {
  useRouteTitle("mobile.settings.notifications");
  const t = useTranslations("accountSettings.notifications");
  const profile = useAccountProfile();
  const { save } = useAccountProfileActions();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  if (profile.data === undefined)
    return <SettingsLoad failed={profile.isError} onRetry={() => void profile.refetch()} />;

  async function change(subscribed: boolean) {
    setSaving(true);
    setFailed(false);
    try {
      await save({ product_news: subscribed });
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View className="gap-5" testID="settings:notifications">
        <Card compact>
          <Switch
            label={t("productNews")}
            value={profile.data.product_news.subscribed}
            onChange={(value) => void change(value)}
            disabled={saving}
          />
          <Text variant="caption" color="mutedForeground">
            {t("productNewsLine")}
          </Text>
        </Card>
        {failed ? (
          <Notice tone="coral" icon={CircleAlert} live>
            {t("saveFailed")}
          </Notice>
        ) : null}
        <SettingsNote>{t("accountEmails")}</SettingsNote>
        <SettingsNote>{t("push")}</SettingsNote>
      </View>
    </Screen>
  );
}
