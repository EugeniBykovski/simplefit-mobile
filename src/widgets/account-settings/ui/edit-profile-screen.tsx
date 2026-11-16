import { useRouter } from "expo-router";
import { CircleAlert } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { useTranslations } from "use-intl";

import {
  useFighterProfile,
  useFighterProfileActions,
  type FighterProfile,
} from "@/entities/fighter-profile";
import {
  AccountStep,
  ExperienceStep,
  WeightStep,
  mergeServer,
  rejectionOf,
  stepErrors,
  stepPatch,
  valuesFrom,
  type Errors,
  type FighterField,
  type FighterValues,
  type FormStepId,
} from "@/features/fighter-onboarding";
import { Button } from "@/shared/ui/button";
import { Notice } from "@/shared/ui/notice";
import { Screen } from "@/shared/ui/screen";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";

import { DiscardGuard } from "./discard-guard";
import { SettingsLoad, UnavailableSettings, useRouteTitle } from "./settings-parts";

/** The FighterProfile sections ST4 edits, in order; goals stay with onboarding. */
const STEPS = ["account", "experience", "weight"] as const satisfies readonly FormStepId[];

/*
 * ST4 · Edit profile (SF-161; SetProfile.dc.html) on `mobile.settings.profile`:
 * the signed-in user's own FighterProfile, edited with the onboarding
 * fields and their rules (SF-25) and saved with
 * `PATCH /api/v1/me/fighter-profile`: only changed fields, the backend
 * validates and its answer replaces the cache. Only a completed profile is
 * edited here: Settings is shared by every shell, and saving would otherwise
 * create a FighterProfile for someone who never chose one. No photo, bio,
 * home gym or visibility switches: the backend has no such fields
 * (D-SF161-04). The verified email is account data (ST2), never edited here.
 */
export function EditProfileScreen() {
  useRouteTitle("mobile.settings.profile");
  const t = useTranslations("accountSettings.profile");
  const profile = useFighterProfile();
  if (profile.data === undefined)
    return <SettingsLoad failed={profile.isError} onRetry={() => void profile.refetch()} />;
  if (profile.data.onboarding.status !== "completed")
    return (
      <UnavailableSettings
        title={t("notFighter.title")}
        body={t("notFighter.body")}
        testID="settings:profile:unavailable"
      />
    );
  return <EditProfileForm profile={profile.data} />;
}

function EditProfileForm({ profile }: { profile: FighterProfile }) {
  const t = useTranslations("accountSettings.profile");
  const titles = useTranslations("fighterOnboarding.titles");
  const router = useRouter();
  const toast = useToast();
  const { save } = useFighterProfileActions();
  const [edits, setEdits] = useState<Partial<FighterValues>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const dirty = Object.fromEntries(Object.keys(edits).map((field) => [field, true]));
  // The backend's current answer under the user's own edits (a save elsewhere is reconciled).
  const values = mergeServer({ ...valuesFrom(profile), ...edits }, dirty, profile);
  const changed = Object.keys(edits).length > 0;

  function change<K extends FighterField>(field: K, value: FighterValues[K]) {
    // Back to the saved value: no longer a change, never sent.
    const saved = JSON.stringify(valuesFrom(profile)[field]) === JSON.stringify(value);
    setEdits((current) => {
      const next = { ...current, [field]: value };
      if (saved) delete next[field];
      return next;
    });
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit() {
    const found: Errors = Object.assign({}, ...STEPS.map((step) => stepErrors(step, values)));
    const patch = Object.assign({}, ...STEPS.map((step) => stepPatch(step, values, dirty, found)));
    setErrors(found);
    setFailed(false);
    if (Object.values(found).some((message) => message !== undefined)) return;
    if (Object.keys(patch).length === 0) return;
    setSaving(true);
    try {
      await save(patch);
      setEdits({});
      toast.show({ title: t("saved"), tone: "success" });
      if (router.canGoBack()) router.back();
    } catch (error) {
      const rejected = rejectionOf(error);
      if (rejected === undefined) setFailed(true);
      else setErrors({ ...found, ...rejected.fields });
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
        <View className="gap-6" testID="settings:profile">
          {STEPS.map((step) => {
            const Step =
              step === "account"
                ? AccountStep
                : step === "experience"
                  ? ExperienceStep
                  : WeightStep;
            return (
              <View key={step} className="gap-3">
                <Text variant="h3" accessibilityRole="header">
                  {titles(step)}
                </Text>
                <Step values={values} errors={errors} disabled={saving} onChange={change} />
              </View>
            );
          })}
          {failed ? (
            <Notice tone="coral" icon={CircleAlert} live>
              {t("saveFailed")}
            </Notice>
          ) : null}
          <Button
            label={saving ? t("saving") : t("save")}
            onPress={() => void submit()}
            disabled={!changed || saving}
            loading={saving}
          />
        </View>
      </Screen>
      <DiscardGuard active={changed && !saving} />
    </KeyboardAvoidingView>
  );
}
