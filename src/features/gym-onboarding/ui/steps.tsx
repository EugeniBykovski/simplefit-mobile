import { Check, ImageOff, Info } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Pressable, View, type TextInput } from "react-native";
import { useTranslations } from "use-intl";

import { rawPalette } from "@/shared/styles/tokens";
import { Chip } from "@/shared/ui/chip";
import { CountryField } from "@/shared/ui/country-field";
import { FieldError } from "@/shared/ui/field-error";
import { useFieldFocus } from "@/shared/ui/field-focus";
import { Icon } from "@/shared/ui/icon";
import { Input } from "@/shared/ui/input";
import { Notice } from "@/shared/ui/notice";
import { Text } from "@/shared/ui/text";

import type { FieldMessage } from "../model/errors";
import {
  ACCENT_COLORS,
  GYM_TYPES,
  LIMITS,
  lengthOf,
  type AccentColor,
  type BrandValues,
  type GymValues,
  type LocationValues,
} from "../model/form-values";

/*
 * The OG1, OG2, OG3 and OG6b step bodies of the mobile Gym owner registration
 * (SF-87), on the approved mobile onboarding frame (Claude Design COACH 3,
 * 390 × 844) with the web OG content and the approved differences
 * (docs/gym-onboarding-mobile.md). They render the values they are given and
 * report changes; saving, navigation and completion belong to the screen
 * (widgets/gym-onboarding). Every vocabulary is the generated SF-85 enum.
 */

export type SetupValues = GymValues & LocationValues & BrandValues;
export type SetupField = keyof SetupValues;
export type SetupErrors = Partial<Record<SetupField, FieldMessage>>;

type StepProps = {
  values: SetupValues;
  errors: SetupErrors;
  disabled: boolean;
  onChange: <K extends SetupField>(field: K, value: SetupValues[K]) => void;
  /** The first invalid field after a rejected action (a new object each time): it takes focus. */
  focus?: { field: SetupField } | undefined;
  /** Brings the top of the step into view (a picker cannot take focus). */
  onRevealTop: () => void;
};

function useMessage(errors: SetupErrors) {
  const t = useTranslations("gymOnboarding.errors");
  return (field: SetupField) => {
    const key = errors[field];
    return key === undefined ? undefined : t(key);
  };
}

/** Moves focus to the first invalid field, or brings the top into view for a picker. */
function useFocusFirst(
  focus: StepProps["focus"],
  refs: Partial<Record<SetupField, React.RefObject<TextInput | null>>>,
  onRevealTop: () => void,
) {
  useEffect(() => {
    if (focus === undefined) return;
    const input = refs[focus.field]?.current;
    if (input) input.focus();
    else onRevealTop();
    // The refs are stable; only a new `focus` object moves focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, onRevealTop]);
}

/** OG1 · Gym name & type, with the optional phone and website. */
export function TypeStep({
  values,
  errors,
  disabled,
  onChange,
  focus,
  onRevealTop,
  anotherGym,
}: StepProps & {
  /** The visitor already has a completed gym: continuing creates another. */
  anotherGym: boolean;
}) {
  const t = useTranslations("gymOnboarding.type");
  const types = useTranslations("gymOnboarding.gymTypes");
  const message = useMessage(errors);
  const onFocus = useFieldFocus();
  const nameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const websiteRef = useRef<TextInput>(null);
  useFocusFirst(focus, { name: nameRef, phone: phoneRef, website: websiteRef }, onRevealTop);
  const typeError = message("gym_type");

  return (
    <View className="gap-4">
      {anotherGym && (
        <Notice tone="muted" icon={Info}>
          {sentences(t("another.title"), t("another.body"))}
        </Notice>
      )}
      <Input
        ref={nameRef}
        label={t("name.label")}
        placeholder={t("name.placeholder")}
        value={values.name}
        onChangeText={(text) => onChange("name", text)}
        autoComplete="organization"
        textContentType="organizationName"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => phoneRef.current?.focus()}
        accessibilityLabel={t("requiredLabel", { label: t("name.label") })}
        description={t("count", { count: lengthOf(values.name), max: LIMITS.name })}
        error={message("name")}
        onFocus={onFocus}
        editable={!disabled}
      />
      <View className="gap-2">
        <Text variant="label" color="faintForeground">
          {t("gymType.label")}
        </Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t("gymType.label")}
          className="flex-row flex-wrap gap-2"
        >
          {GYM_TYPES.map((type) => (
            <Chip
              key={type}
              label={types(type)}
              checked={values.gym_type === type}
              disabled={disabled}
              onPress={() => onChange("gym_type", type)}
            />
          ))}
        </View>
        {typeError ? <FieldError message={typeError} /> : null}
      </View>
      <Input
        ref={phoneRef}
        label={t("phone.label")}
        placeholder={t("phone.placeholder")}
        value={values.phone}
        onChangeText={(text) => onChange("phone", text)}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => websiteRef.current?.focus()}
        description={t("phone.help")}
        error={message("phone")}
        onFocus={onFocus}
        editable={!disabled}
      />
      <Input
        ref={websiteRef}
        label={t("website.label")}
        placeholder={t("website.placeholder")}
        value={values.website}
        onChangeText={(text) => onChange("website", text)}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="url"
        textContentType="URL"
        returnKeyType="done"
        description={t("website.help")}
        error={message("website")}
        onFocus={onFocus}
        editable={!disabled}
      />
      <Notice tone="muted" icon={Info}>
        {t("account")}
      </Notice>
    </View>
  );
}

/** OG2 · Location: the one primary location (its name defaults to the city). */
export function LocationStep({
  values,
  errors,
  disabled,
  onChange,
  focus,
  onRevealTop,
}: StepProps) {
  const t = useTranslations("gymOnboarding.location");
  const message = useMessage(errors);
  const onFocus = useFieldFocus();
  const cityRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const noteRef = useRef<TextInput>(null);
  useFocusFirst(
    focus,
    { city: cityRef, address_line: addressRef, entrance_note: noteRef },
    onRevealTop,
  );

  return (
    <View className="gap-4">
      <CountryField
        label={t("country.label")}
        copy={{
          placeholder: t("country.placeholder"),
          none: t("country.none"),
          hint: t("country.hint"),
          title: t("country.label"),
          close: t("country.close"),
          search: t("country.search"),
          empty: t("country.empty"),
        }}
        value={values.country_code}
        onChange={(code) => onChange("country_code", code)}
        error={message("country_code")}
      />
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
        onSubmitEditing={() => addressRef.current?.focus()}
        accessibilityLabel={t("requiredLabel", { label: t("city.label") })}
        error={message("city")}
        onFocus={onFocus}
        editable={!disabled}
      />
      <Input
        ref={addressRef}
        label={t("address.label")}
        placeholder={t("address.placeholder")}
        value={values.address_line}
        onChangeText={(text) => onChange("address_line", text)}
        autoComplete="street-address"
        textContentType="fullStreetAddress"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => noteRef.current?.focus()}
        accessibilityLabel={t("requiredLabel", { label: t("address.label") })}
        error={message("address_line")}
        onFocus={onFocus}
        editable={!disabled}
      />
      <Input
        ref={noteRef}
        label={t("entrance.label")}
        placeholder={t("entrance.placeholder")}
        value={values.entrance_note}
        onChangeText={(text) => onChange("entrance_note", text)}
        returnKeyType="done"
        description={t("entrance.help")}
        error={message("entrance_note")}
        onFocus={onFocus}
        editable={!disabled}
      />
      <Notice tone="muted" icon={Info}>
        {sentences(t("more"), t("note"))}
      </Notice>
    </View>
  );
}

/** The swatch names, in the contract's order of `ACCENT_COLORS`. */
const ACCENT_NAMES = ["olive", "amber", "coral", "sky", "bone", "moss"] as const;
const accentName = (color: AccentColor) =>
  ACCENT_NAMES[ACCENT_COLORS.indexOf(color)] ?? ACCENT_NAMES[0];

/** Two message parts as one notice text: a full stop after a title without its own. */
export const sentences = (title: string, body: string) =>
  /[.!?…:]$/.test(title.trim()) ? `${title} ${body}` : `${title}. ${body}`;

/** The gym's initials for the logo tile (no logo upload exists yet). */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

/** On a chosen swatch (runtime data, all six light) the ink is always graphite. */
const INK = rawPalette.graphite950;

/** OG3 · Branding, all optional: accent colour and tagline; Logo and Cover not available yet. */
export function BrandingStep({
  values,
  errors,
  disabled,
  onChange,
  focus,
  onRevealTop,
  gymName,
}: StepProps & { gymName: string }) {
  const t = useTranslations("gymOnboarding.branding");
  const message = useMessage(errors);
  const onFocus = useFieldFocus();
  const taglineRef = useRef<TextInput>(null);
  useFocusFirst(focus, { tagline: taglineRef }, onRevealTop);
  const accent = values.accent_color;

  return (
    <View className="gap-5">
      <View className="flex-row items-center gap-4">
        <View
          accessible
          accessibilityLabel={t("logo.unavailable")}
          className={`size-[72px] items-center justify-center rounded-3xl ${accent === null ? "bg-primary" : ""}`}
          // Runtime data: the gym's chosen accent colour.
          style={accent === null ? undefined : { backgroundColor: accent }}
        >
          {/* Decorative (the tile is labelled): the initials keep the tile's size at large text. */}
          <Text
            variant="h2"
            color="primaryForeground"
            maxFontSizeMultiplier={1}
            // Runtime: on a chosen swatch the ink is always graphite.
            style={accent === null ? undefined : { color: INK }}
          >
            {initialsOf(gymName)}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          <Text variant="caption" weight="bold" color="mutedForeground">
            {t("logo.label")}
          </Text>
          <Text variant="caption" color="faintForeground">
            {t("logo.unavailable")}
          </Text>
        </View>
      </View>
      <View className="gap-2.5">
        <Text variant="label" color="faintForeground">
          {t("accent.label")}
        </Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t("accent.label")}
          className="flex-row flex-wrap items-center gap-1"
        >
          {ACCENT_COLORS.map((color) => {
            const checked = accent === color;
            return (
              <Pressable
                key={color}
                accessibilityRole="radio"
                accessibilityLabel={t(`accent.colors.${accentName(color)}`)}
                accessibilityState={{ checked, disabled }}
                disabled={disabled}
                onPress={() => onChange("accent_color", color)}
                className={`size-11 items-center justify-center rounded-xl ${checked ? "border-2 border-highlight" : ""}`}
              >
                <View
                  className="size-[34px] items-center justify-center rounded-sm"
                  // Runtime data: one of the six contract swatches.
                  style={{ backgroundColor: color }}
                >
                  {checked ? <Check size={16} color={INK} strokeWidth={3} /> : null}
                </View>
              </Pressable>
            );
          })}
          {accent !== null && (
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              onPress={() => onChange("accent_color", null)}
              hitSlop={8}
              className="ml-2 min-h-11 justify-center"
            >
              <Text
                variant="caption"
                weight="extrabold"
                color="mutedForeground"
                className="underline"
              >
                {t("accent.clear")}
              </Text>
            </Pressable>
          )}
        </View>
        <Text variant="caption" color="faintForeground">
          {t("accent.help")}
        </Text>
        {message("accent_color") ? <FieldError message={message("accent_color") ?? ""} /> : null}
      </View>
      <Input
        ref={taglineRef}
        label={t("tagline.label")}
        placeholder={t("tagline.placeholder")}
        value={values.tagline}
        onChangeText={(text) => onChange("tagline", text)}
        returnKeyType="done"
        description={t("tagline.count", { count: lengthOf(values.tagline), max: LIMITS.tagline })}
        error={message("tagline")}
        onFocus={onFocus}
        editable={!disabled}
      />
      <View className="gap-2">
        <Text variant="caption" weight="bold" color="mutedForeground">
          {t("cover.label")}
        </Text>
        <View
          accessible
          accessibilityLabel={t("cover.unavailable")}
          className="min-h-24 flex-row items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-border-strong px-4 py-3"
        >
          <Icon icon={ImageOff} size={18} color="faintForeground" />
          <Text
            variant="bodySm"
            weight="bold"
            color="faintForeground"
            className="shrink text-center"
          >
            {t("cover.unavailable")}
          </Text>
        </View>
      </View>
    </View>
  );
}

const LATER = [
  "verify",
  "memberships",
  "payments",
  "timetable",
  "team",
  "import",
  "community",
  "launch",
] as const;

/** OG6b · Gym created: shown only after the backend recorded completion. */
export function CreatedStep() {
  const t = useTranslations("gymOnboarding.done");
  return (
    <View className="gap-4">
      <Notice tone="muted" icon={Info}>
        {sentences(t("pendingTitle"), t("pendingBody"))}
      </Notice>
      <View className="gap-1 rounded-3xl border border-border bg-surface p-4">
        <Text variant="label" color="faintForeground" accessibilityRole="header">
          {t("laterTitle")}
        </Text>
        <View accessibilityRole="list">
          {LATER.map((step, index) => (
            <View
              key={step}
              className={`min-h-14 flex-row items-center gap-3 py-2 ${index < LATER.length - 1 ? "border-b border-border-subtle" : ""}`}
            >
              <View className="flex-1 gap-0.5">
                <Text variant="body" weight="extrabold" color="mutedForeground">
                  {t(`later.${step}.title`)}
                </Text>
                <Text variant="caption" color="faintForeground">
                  {t(`later.${step}.sub`)}
                </Text>
              </View>
              <View className="rounded-sm bg-surface-elevated px-2.5 py-1">
                <Text variant="badge" color="faintForeground">
                  {t("laterBadge")}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
