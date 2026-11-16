import { KeyRound, Mail, type LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";

import { useSignInMethods, type SignInMethod } from "@/entities/sign-in-method";
import { SignOutButton } from "@/features/sign-out";
import { Screen } from "@/shared/ui/screen";

import {
  SettingsLoad,
  SettingsNote,
  SettingsRow,
  SettingsSection,
  useRouteTitle,
} from "./settings-parts";

const ICONS: Record<SignInMethod["provider"], LucideIcon> = {
  email: Mail,
  google: KeyRound,
  apple: KeyRound,
};

/*
 * ST3 · Sign-in & security (SF-161; SetSecurity.dc.html, current design
 * scope SF-21) on `mobile.settings.security`: how this account signs in, from
 * `GET /api/v1/me/sign-in-methods` (proven email addresses; Google and Apple
 * by provider only, never their account ids). The public apps are
 * passwordless (D-SF157-02): no password, passkey or session list is offered.
 * Sign-in alert emails are not sent by the backend, so ST3's Alerts section
 * is not shown. Sign out ends the session on this phone only.
 */
export function SecurityScreen() {
  useRouteTitle("mobile.settings.security");
  const t = useTranslations("accountSettings.security");
  const format = useFormatter();
  const methods = useSignInMethods();
  if (methods.data === undefined)
    return <SettingsLoad failed={methods.isError} onRetry={() => void methods.refetch()} />;

  return (
    <Screen>
      <View className="gap-5" testID="settings:security">
        <SettingsSection title={t("methodsTitle")}>
          {methods.data.map((method, index) => (
            <SettingsRow
              key={`${method.provider}:${method.email ?? index}`}
              icon={ICONS[method.provider]}
              label={t(`providers.${method.provider}`)}
              line={
                method.provider === "email" && method.email !== null
                  ? t("emailLine", { email: method.email })
                  : t("providerLine")
              }
              value={t("since", {
                date: format.dateTime(new Date(method.linked_at), { dateStyle: "medium" }),
              })}
              last={index === methods.data.length - 1}
            />
          ))}
        </SettingsSection>
        <SettingsNote>{t("passwordless")}</SettingsNote>
        <SettingsSection title={t("thisPhone")}>
          <SettingsRow label={t("signOutLine")} last />
        </SettingsSection>
        <SignOutButton />
      </View>
    </Screen>
  );
}
