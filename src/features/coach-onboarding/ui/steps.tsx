import { CircleCheck, Info } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { View, type TextInput } from "react-native";
import { useLocale, useTranslations } from "use-intl";

import type { CoachProfile } from "@/entities/coach-profile";
import { countryName } from "@/shared/lib/countries";
import { Avatar } from "@/shared/ui/avatar";
import { ChoiceCard } from "@/shared/ui/choice-card";
import { Chip } from "@/shared/ui/chip";
import { CountryField } from "@/shared/ui/country-field";
import { FieldError } from "@/shared/ui/field-error";
import { useFieldFocus } from "@/shared/ui/field-focus";
import { Icon } from "@/shared/ui/icon";
import { Input } from "@/shared/ui/input";
import { Notice } from "@/shared/ui/notice";
import { Text } from "@/shared/ui/text";
import { Textarea } from "@/shared/ui/textarea";

import {
  COACHING_FORMATS,
  COMPETITION_LEVELS,
  LANGUAGES,
  LIMITS,
  lengthOf,
  toggled,
  type CoachField,
  type CoachValues,
  type Errors,
} from "../model/form";

/*
 * The OC1, OC2 and OC11 step bodies (Claude Design COACH 3, version
 * 1791966129-8ecb, 390 × 844). They render the values they are given and
 * report changes; saving, navigation and completion belong to the screen
 * (widgets/coach-onboarding). Every vocabulary is the generated SF-50 enum.
 */

type FormProps = {
  values: CoachValues;
  errors: Errors;
  disabled: boolean;
  onChange: <K extends CoachField>(field: K, value: CoachValues[K]) => void;
};

function useMessage(errors: Errors) {
  const t = useTranslations("coachOnboarding.errors");
  return (field: CoachField) => {
    const code = errors[field];
    return code === undefined ? undefined : t(code);
  };
}

/**
 * OC1 · Coach profile: coach name (an account-name suggestion only while it
 * is the untouched value of a new profile), brand, country, city, bio and
 * coaching languages.
 */
export function ProfileStep({
  values,
  errors,
  disabled,
  onChange,
  suggested,
  focus,
  onRevealTop,
}: FormProps & {
  suggested: boolean;
  /** The first invalid field after a rejected Continue (a new object each time): it takes focus. */
  focus?: { field: CoachField } | undefined;
  /** Brings the top of the step into view (the country picker cannot take focus). */
  onRevealTop: () => void;
}) {
  const t = useTranslations("coachOnboarding.profile");
  const country = useTranslations("coachOnboarding.country");
  const message = useMessage(errors);
  const onFocus = useFieldFocus();
  // The keyboard's "next" key walks Coach name → Brand → City → Bio (Country is a picker).
  const nameRef = useRef<TextInput>(null);
  const brandRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const bioRef = useRef<TextInput>(null);

  // After a rejected Continue the first invalid field takes focus (and the
  // screen scrolls it into view); the country picker brings the top in view.
  useEffect(() => {
    if (focus === undefined) return;
    const refs: Partial<Record<CoachField, typeof nameRef>> = {
      display_name: nameRef,
      brand_name: brandRef,
      city: cityRef,
      bio: bioRef,
    };
    const input = refs[focus.field]?.current;
    if (input) input.focus();
    else onRevealTop();
  }, [focus, onRevealTop]);

  return (
    <View className="gap-4">
      <Input
        ref={nameRef}
        label={t("name.label")}
        placeholder={t("name.placeholder")}
        value={values.display_name}
        onChangeText={(text) => onChange("display_name", text)}
        autoComplete="name"
        textContentType="nickname"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => brandRef.current?.focus()}
        accessibilityLabel={t("requiredLabel", { label: t("name.label") })}
        description={suggested ? t("name.suggested") : t("name.help")}
        error={message("display_name")}
        onFocus={onFocus}
        editable={!disabled}
      />
      <Input
        ref={brandRef}
        label={t("brand.label")}
        placeholder={t("brand.placeholder")}
        value={values.brand_name}
        onChangeText={(text) => onChange("brand_name", text)}
        autoComplete="organization"
        textContentType="organizationName"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => cityRef.current?.focus()}
        description={t("brand.help")}
        error={message("brand_name")}
        onFocus={onFocus}
        editable={!disabled}
      />
      <View className="flex-row gap-3">
        <CountryField
          label={t("country")}
          copy={{
            placeholder: country("placeholder"),
            none: country("none"),
            hint: country("hint"),
            title: country("title"),
            close: country("close"),
            search: country("search"),
            empty: country("empty"),
          }}
          value={values.country_code}
          onChange={(code) => onChange("country_code", code)}
          error={message("country_code")}
        />
        <View className="flex-1">
          <Input
            ref={cityRef}
            label={t("city.label")}
            placeholder={t("city.placeholder")}
            value={values.city}
            onChangeText={(text) => onChange("city", text)}
            autoComplete="postal-address-locality"
            textContentType="addressCity"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => bioRef.current?.focus()}
            accessibilityLabel={t("requiredLabel", { label: t("city.label") })}
            error={message("city")}
            onFocus={onFocus}
            editable={!disabled}
          />
        </View>
      </View>
      <Textarea
        ref={bioRef}
        label={t("bio.label")}
        placeholder={t("bio.placeholder")}
        value={values.bio}
        onChangeText={(text) => onChange("bio", text)}
        description={t("bio.count", { count: lengthOf(values.bio), max: LIMITS.bio })}
        error={message("bio")}
        onFocus={onFocus}
        editable={!disabled}
      />
      <View className="gap-2">
        <Text variant="label" color="faintForeground">
          {t("languages.label")}
        </Text>
        <View
          accessibilityRole="list"
          accessibilityLabel={t("languages.label")}
          className="flex-row flex-wrap gap-2"
        >
          {LANGUAGES.map((language) => (
            <Chip
              key={language}
              multiple
              label={t(`languages.options.${language}`)}
              checked={values.languages.includes(language)}
              disabled={disabled}
              onPress={() => onChange("languages", toggled(LANGUAGES, values.languages, language))}
            />
          ))}
        </View>
        {message("languages") ? <FieldError message={message("languages") ?? ""} /> : null}
      </View>
    </View>
  );
}

/** OC2 · Coaching type: at least one coaching format, and optional competition levels. */
export function TypeStep({ values, errors, disabled, onChange }: FormProps) {
  const t = useTranslations("coachOnboarding.type");
  const message = useMessage(errors);
  const formatsError = message("coaching_formats");
  return (
    <View className="gap-4">
      <View className="gap-2.5">
        <View className="flex-row items-baseline justify-between gap-3">
          <Text variant="label" color="faintForeground">
            {t("formats.label")}
          </Text>
          {formatsError ? null : (
            <Text variant="caption" color="faintForeground">
              {t("formats.help")}
            </Text>
          )}
        </View>
        <View accessibilityLabel={t("formats.label")} className="gap-2.5">
          {COACHING_FORMATS.map((format) => (
            <ChoiceCard
              key={format}
              multiple
              title={t(`formats.options.${format}.label`)}
              body={t(`formats.options.${format}.description`)}
              checked={values.coaching_formats.includes(format)}
              disabled={disabled}
              onPress={() =>
                onChange(
                  "coaching_formats",
                  toggled(COACHING_FORMATS, values.coaching_formats, format),
                )
              }
            />
          ))}
        </View>
        {formatsError ? <FieldError message={formatsError} /> : null}
      </View>
      <View className="gap-2">
        <View className="flex-row flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <Text variant="label" color="faintForeground">
            {t("levels.label")}
          </Text>
          <Text variant="caption" color="faintForeground">
            {t("levels.help")}
          </Text>
        </View>
        <View
          accessibilityRole="list"
          accessibilityLabel={t("levels.label")}
          className="flex-row flex-wrap gap-2"
        >
          {COMPETITION_LEVELS.map((level) => (
            <Chip
              key={level}
              multiple
              label={t(`levels.options.${level}`)}
              checked={values.competition_levels.includes(level)}
              disabled={disabled}
              onPress={() =>
                onChange(
                  "competition_levels",
                  toggled(COMPETITION_LEVELS, values.competition_levels, level),
                )
              }
            />
          ))}
        </View>
        {message("competition_levels") ? (
          <FieldError message={message("competition_levels") ?? ""} />
        ) : null}
      </View>
    </View>
  );
}

/**
 * OC11 · Complete: the saved profile, shown only after the backend confirmed
 * completion. Says plainly that the coach tools do not exist yet.
 */
export function CompleteStep({ profile }: { profile: CoachProfile }) {
  const t = useTranslations("coachOnboarding.done");
  const type = useTranslations("coachOnboarding.type");
  const languages = useTranslations("coachOnboarding.profile.languages.options");
  const locale = useLocale();
  const name = profile.display_name ?? "";
  const place = [
    profile.city,
    profile.country_code === null ? null : countryName(profile.country_code, locale),
  ]
    .filter(Boolean)
    .join(", ");
  const line = [profile.brand_name, place].filter(Boolean).join(" · ");
  const list = (items: string[]) => (items.length === 0 ? t("none") : items.join(" · "));
  const rows: [string, string][] = [
    [
      t("formats"),
      list(profile.coaching_formats.map((format) => type(`formats.options.${format}.label`))),
    ],
    [
      t("competition"),
      list(profile.competition_levels.map((level) => type(`levels.options.${level}`))),
    ],
    [t("languages"), list(profile.languages.map((language) => languages(language)))],
  ];

  return (
    <View className="gap-4">
      <View className="size-16 items-center justify-center rounded-3xl bg-primary">
        <Icon icon={CircleCheck} size={32} color="primaryForeground" />
      </View>
      <View className="gap-2.5 rounded-3xl border border-border bg-surface px-4 py-3.5">
        <Text variant="label" color="faintForeground">
          {t("card")}
        </Text>
        <View className="flex-row items-center gap-3">
          <Avatar name={name} />
          <View className="flex-1 gap-0.5">
            <Text variant="bodyLg" weight="extrabold" numberOfLines={2}>
              {name}
            </Text>
            {line === "" ? null : (
              <Text variant="caption" color="mutedForeground">
                {line}
              </Text>
            )}
          </View>
        </View>
        <View>
          {rows.map(([label, value]) => (
            <View
              key={label}
              accessible
              accessibilityLabel={`${label}: ${value}`}
              className="min-h-11 flex-row items-center gap-3 border-t border-border py-1.5"
            >
              <Text variant="caption" weight="bold" color="faintForeground" className="w-24">
                {label}
              </Text>
              <Text variant="bodySm" weight="bold" className="flex-1">
                {value}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <Notice tone="muted" icon={Info}>
        {t.rich("pending", {
          b: (chunks) => (
            <Text variant="caption" weight="extrabold" color="foreground">
              {chunks}
            </Text>
          ),
        })}
      </Notice>
    </View>
  );
}
