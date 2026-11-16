import { CircleAlert } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";

import { useAccountProfile, useAccountProfileActions } from "@/entities/account-profile";
import { emailsOf, useSignInMethods } from "@/entities/sign-in-method";
import { LanguageSelector } from "@/features/switch-locale";
import { isApiError } from "@/shared/api/http/api-error";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Notice } from "@/shared/ui/notice";
import { Screen } from "@/shared/ui/screen";
import { useToast } from "@/shared/ui/toast";

import { DiscardGuard } from "./discard-guard";
import {
  SettingsLoad,
  SettingsNote,
  SettingsRow,
  SettingsSection,
  useRouteTitle,
} from "./settings-parts";

type NameError = "required" | "tooLong" | undefined;

/*
 * ST2 · Account details (SF-161; Settings design SetAccount.dc.html) on
 * `mobile.settings.account`: the person's global account, never a role
 * profile. The full name is the AccountProfile's and is saved with
 * `PATCH /api/v1/me/account-profile` (the backend validates it); the date of
 * birth cannot change after registration (the backend refuses it) and is
 * shown only. Email addresses are the account's proven sign-in addresses:
 * no email change contract exists, so they are read-only. Language is this
 * device's preference (SF-38), not account data. Phone, region and currency,
 * the handle and the workspaces of the artboard have no account field here.
 */
export function AccountDetailsScreen() {
  useRouteTitle("mobile.settings.account");
  const profile = useAccountProfile();
  const methods = useSignInMethods();
  if (profile.data === undefined || methods.data === undefined) {
    return (
      <SettingsLoad
        failed={profile.isError || methods.isError}
        onRetry={() => {
          void profile.refetch();
          void methods.refetch();
        }}
      />
    );
  }
  return (
    <AccountDetailsForm
      fullName={profile.data.full_name ?? ""}
      dateOfBirth={profile.data.date_of_birth}
      emails={emailsOf(methods.data)}
    />
  );
}

function AccountDetailsForm({
  fullName,
  dateOfBirth,
  emails,
}: {
  fullName: string;
  dateOfBirth: string | null;
  emails: string[];
}) {
  const t = useTranslations("accountSettings.account");
  const format = useFormatter();
  const toast = useToast();
  const { save } = useAccountProfileActions();
  const [name, setName] = useState(fullName);
  const [error, setError] = useState<NameError>();
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== fullName.trim();

  async function submit() {
    const trimmed = name.trim();
    if (trimmed === "") return setError("required");
    setError(undefined);
    setFailed(false);
    setSaving(true);
    try {
      const saved = await save({ full_name: trimmed });
      setName(saved.full_name ?? "");
      toast.show({ title: t("saved"), tone: "success" });
    } catch (cause) {
      if (isApiError(cause) && cause.code === "validation_error") {
        const codes = cause.fieldCodes["full_name"] ?? [];
        setError(codes.includes("too_long") ? "tooLong" : "required");
      } else setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <Screen>
        <View className="gap-5" testID="settings:account">
          <View className="gap-3">
            <Input
              label={t("fullName")}
              description={t("fullNameHint")}
              value={name}
              onChangeText={(text) => {
                setName(text);
                setError(undefined);
              }}
              error={error === undefined ? undefined : t(`errors.${error}`)}
              autoComplete="name"
              textContentType="name"
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              editable={!saving}
            />
            {failed ? (
              <Notice tone="coral" icon={CircleAlert} live>
                {t("saveFailed")}
              </Notice>
            ) : null}
            <Button
              label={saving ? t("saving") : t("save")}
              onPress={() => void submit()}
              disabled={!dirty || saving}
              loading={saving}
            />
          </View>

          <SettingsSection title={t("email")}>
            {emails.length === 0 ? (
              <SettingsRow label={t("noEmail")} last />
            ) : (
              emails.map((email, index) => (
                <View key={email} className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <SettingsRow label={email} last={index === emails.length - 1} />
                  </View>
                  <Badge label={t("verified")} />
                </View>
              ))
            )}
          </SettingsSection>
          <SettingsNote>{t("emailNote")}</SettingsNote>

          <SettingsSection>
            <SettingsRow
              label={t("dateOfBirth")}
              line={t("dateOfBirthNote")}
              value={
                dateOfBirth === null
                  ? undefined
                  : format.dateTime(new Date(`${dateOfBirth}T00:00:00Z`), {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    })
              }
              last
            />
          </SettingsSection>

          <LanguageSelector />
        </View>
      </Screen>
      <DiscardGuard active={dirty && !saving} />
    </KeyboardAvoidingView>
  );
}
