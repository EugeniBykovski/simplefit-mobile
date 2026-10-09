import { Lock } from "lucide-react-native";
import { useRef } from "react";
import { View, type TextInput } from "react-native";
import { useLocale, useTranslations } from "use-intl";

import type { FighterProfile } from "@/entities/fighter-profile";
import { countryName } from "@/shared/lib/countries";
import { datePattern, isoFromMasked, maskDate } from "@/shared/lib/date-input";
import { Input } from "@/shared/ui/input";
import { Notice } from "@/shared/ui/notice";
import { Text } from "@/shared/ui/text";

import {
  EXPERIENCE_LEVELS,
  GOALS,
  STANCES,
  WEIGHT_CLASSES,
  type Errors,
  type FighterField,
  type FighterValues,
} from "../model/form";
import type { InfoStepId } from "../model/steps";
import { ChoiceCard, Chip, CountryField, FieldError, SegmentChoice } from "./controls";
import { useFieldFocus } from "./field-focus";

/*
 * The OF1–OF11 step bodies (Claude Design FIGHTER 2, 390 × 844). They render
 * the values they are given and report changes; saving, navigation and
 * completion belong to the screen (widgets/fighter-onboarding).
 */

type FormProps = {
  values: FighterValues;
  errors: Errors;
  disabled: boolean;
  onChange: <K extends FighterField>(field: K, value: FighterValues[K]) => void;
};

function useMessage(errors: Errors) {
  const t = useTranslations("fighterOnboarding.errors");
  return (field: FighterField) => {
    const code = errors[field];
    return code === undefined ? undefined : t(code);
  };
}

/** OF1 · Account: name, username, country, city (SF-25). */
export function AccountStep({ values, errors, disabled, onChange }: FormProps) {
  const t = useTranslations("fighterOnboarding.account");
  const message = useMessage(errors);
  const onFocus = useFieldFocus();
  // The keyboard's "next" key walks Name → Username → City (Country is a picker).
  const usernameRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  return (
    <View className="gap-4">
      <Input
        label={t("name")}
        value={values.display_name}
        onChangeText={(text) => onChange("display_name", text)}
        autoComplete="name"
        textContentType="nickname"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => usernameRef.current?.focus()}
        maxLength={80}
        error={message("display_name")}
        onFocus={onFocus}
        editable={!disabled}
      />
      <Input
        ref={usernameRef}
        label={t("username")}
        value={values.username}
        onChangeText={(text) => onChange("username", text.replace(/^@/, ""))}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => cityRef.current?.focus()}
        maxLength={30}
        description={t("usernameHint")}
        error={message("username")}
        onFocus={onFocus}
        editable={!disabled}
      />
      <View className="flex-row gap-3">
        <CountryField
          label={t("country")}
          value={values.country_code}
          onChange={(code) => onChange("country_code", code)}
          error={message("country_code")}
        />
        <View className="flex-1">
          <Input
            ref={cityRef}
            label={t("city")}
            value={values.city}
            onChangeText={(text) => onChange("city", text)}
            autoComplete="postal-address-locality"
            textContentType="addressCity"
            returnKeyType="done"
            maxLength={120}
            error={message("city")}
            onFocus={onFocus}
            editable={!disabled}
          />
        </View>
      </View>
    </View>
  );
}

/** OF2 · Experience: the level, the amateur record with Competitive Amateur, and the stance. */
export function ExperienceStep({ values, errors, disabled, onChange }: FormProps) {
  const t = useTranslations("fighterOnboarding.experience");
  const titles = useTranslations("fighterOnboarding.titles");
  const message = useMessage(errors);
  const onFocus = useFieldFocus();
  return (
    <View className="gap-2.5">
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={titles("experience")}
        className="gap-2.5"
      >
        {EXPERIENCE_LEVELS.map((level) => (
          <ChoiceCard
            key={level}
            title={t(`levels.${level}.title`)}
            body={t(`levels.${level}.body`)}
            checked={values.experience_level === level}
            disabled={disabled}
            onPress={() => onChange("experience_level", level)}
          />
        ))}
      </View>
      {message("experience_level") ? (
        <FieldError message={message("experience_level") ?? ""} />
      ) : null}
      {values.experience_level === "competitive_amateur" && (
        <Input
          label={t("bouts")}
          value={values.amateur_bout_count}
          onChangeText={(text) => onChange("amateur_bout_count", text)}
          keyboardType="number-pad"
          maxLength={4}
          description={t("boutsHint")}
          error={message("amateur_bout_count")}
          onFocus={onFocus}
          editable={!disabled}
        />
      )}
      <View className="pt-1.5">
        <SegmentChoice
          label={t("stance")}
          options={STANCES.map((stance) => ({ value: stance, label: t(`stances.${stance}`) }))}
          value={values.stance}
          onChange={(stance) => onChange("stance", stance)}
          error={message("stance")}
        />
      </View>
    </View>
  );
}

/** OF3 · Goals: any of the five goals, and an optional next fight (date and event). */
export function GoalsStep({
  values,
  errors,
  disabled,
  onChange,
  dateText,
  onDateText,
}: FormProps & { dateText: string; onDateText: (text: string) => void }) {
  const t = useTranslations("fighterOnboarding.goals");
  const letters = useTranslations("fighterOnboarding.letters");
  const locale = useLocale();
  const message = useMessage(errors);
  const onFocus = useFieldFocus();
  return (
    <View className="gap-2.5">
      {GOALS.map((goal) => {
        const checked = values.goals.includes(goal);
        return (
          <ChoiceCard
            key={goal}
            multiple
            title={t(`items.${goal}.title`)}
            body={t(`items.${goal}.body`)}
            checked={checked}
            disabled={disabled}
            onPress={() =>
              onChange(
                "goals",
                checked
                  ? values.goals.filter((item) => item !== goal)
                  : GOALS.filter((item) => item === goal || values.goals.includes(item)),
              )
            }
          />
        );
      })}
      <View className="gap-3 pt-1.5">
        <Text variant="label" color="faintForeground">
          {t("nextFight")}
        </Text>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Input
              label={t("nextFightDate")}
              value={dateText}
              onChangeText={(text) => {
                const masked = maskDate(text, locale);
                onDateText(masked);
                onChange("next_fight_on", isoFromMasked(masked, locale));
              }}
              placeholder={datePattern(locale, {
                day: letters("day"),
                month: letters("month"),
                year: letters("year"),
              })}
              keyboardType="number-pad"
              error={message("next_fight_on")}
              onFocus={onFocus}
              editable={!disabled}
            />
          </View>
          <View className="flex-1">
            <Input
              label={t("nextFightName")}
              value={values.next_fight_name}
              onChangeText={(text) => onChange("next_fight_name", text)}
              maxLength={120}
              error={message("next_fight_name")}
              onFocus={onFocus}
              editable={!disabled}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

/** OF4 · Weight class: the class chips, current weight and height, and the privacy note. */
export function WeightStep({ values, errors, disabled, onChange }: FormProps) {
  const t = useTranslations("fighterOnboarding.weight");
  const message = useMessage(errors);
  const onFocus = useFieldFocus();
  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text variant="label" color="faintForeground">
          {t("classLabel")}
        </Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t("classLabel")}
          className="flex-row flex-wrap gap-2"
        >
          {WEIGHT_CLASSES.map((weightClass) => (
            <Chip
              key={weightClass}
              label={t(`classes.${weightClass}`)}
              checked={values.weight_class === weightClass}
              onPress={() =>
                onChange("weight_class", values.weight_class === weightClass ? null : weightClass)
              }
            />
          ))}
        </View>
        {message("weight_class") ? <FieldError message={message("weight_class") ?? ""} /> : null}
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Input
            label={t("weight")}
            value={values.current_weight_kg}
            onChangeText={(text) => onChange("current_weight_kg", text)}
            keyboardType="decimal-pad"
            maxLength={6}
            unit={t("kg")}
            error={message("current_weight_kg")}
            onFocus={onFocus}
            editable={!disabled}
          />
        </View>
        <View className="flex-1">
          <Input
            label={t("height")}
            value={values.height_cm}
            onChangeText={(text) => onChange("height_cm", text)}
            keyboardType="number-pad"
            maxLength={3}
            unit={t("cm")}
            error={message("height_cm")}
            onFocus={onFocus}
            editable={!disabled}
          />
        </View>
      </View>
      <Notice tone="olive" icon={Lock}>
        {t.rich("private", {
          b: (chunks) => (
            <Text variant="caption" weight="extrabold" color="accentForeground">
              {chunks}
            </Text>
          ),
        })}
      </Notice>
    </View>
  );
}

/**
 * OF5–OF10: the steps whose domain does not exist yet. They say what the
 * step will do and record nothing; no list, request, toggle or permission is
 * shown as if it worked (SF-39 decision). OF8 shows the one real privacy fact:
 * body weight is private (SF-25).
 */
export function InfoStep({ id }: { id: InfoStepId }) {
  const t = useTranslations("fighterOnboarding.info");
  return (
    <View className="gap-3">
      <Notice tone="muted" icon={Lock}>
        {t(`${id}.body`)}
      </Notice>
      {id === "privacy" && (
        <View className="rounded-3xl border border-border bg-surface px-4 py-1">
          <Text variant="label" color="faintForeground" className="pb-1 pt-3">
            {t("privacy.neverPublic")}
          </Text>
          <View className="min-h-15 flex-row items-center gap-3 py-2">
            <Text variant="body" weight="extrabold" className="flex-1">
              {t("privacy.weight")}
            </Text>
            <Text
              variant="badge"
              color="mutedForeground"
              className="rounded-sm bg-muted px-2.5 py-1"
            >
              {t("privacy.never")}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

/** OF11 · Complete: the saved profile, shown only after the backend confirmed completion. */
export function CompleteStep({ profile }: { profile: FighterProfile }) {
  const t = useTranslations("fighterOnboarding.complete");
  const experience = useTranslations("fighterOnboarding.experience");
  const weight = useTranslations("fighterOnboarding.weight");
  const locale = useLocale();
  const rows = [
    profile.experience_level && [
      t("experience"),
      experience(`levels.${profile.experience_level}.title`),
    ],
    profile.stance && [t("stance"), experience(`stances.${profile.stance}`)],
    profile.weight_class && [t("weightClass"), weight(`classes.${profile.weight_class}`)],
    profile.country_code && [
      t("from"),
      [profile.city, countryName(profile.country_code, locale)].filter(Boolean).join(", "),
    ],
  ].filter((row): row is [string, string] => Array.isArray(row));

  return (
    <View className="gap-3">
      <View className="gap-1.5 rounded-4xl bg-primary p-5">
        <Text variant="label" color="primaryForeground">
          {t("label")}
        </Text>
        <Text variant="metricLg" color="primaryForeground" numberOfLines={2}>
          {profile.display_name ?? ""}
        </Text>
        {profile.username ? (
          <Text weight="extrabold" color="primaryForeground">
            @{profile.username}
          </Text>
        ) : null}
      </View>
      <View className="rounded-3xl border border-border bg-surface px-4 py-1">
        {rows.map(([label, value], index) => (
          <View
            key={label}
            className={`min-h-15 flex-row items-center gap-3 py-2 ${index < rows.length - 1 ? "border-b border-border" : ""}`}
          >
            <Text variant="caption" color="mutedForeground" className="flex-1">
              {label}
            </Text>
            <Text variant="body" weight="extrabold">
              {value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
