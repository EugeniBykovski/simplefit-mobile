import { Check, ChevronDown, Search, X } from "lucide-react-native";
import { useMemo, useState, type ReactNode } from "react";
import { FlatList, Modal, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale, useTranslations } from "use-intl";

import { countryName, countryOptions, searchCountries } from "@/shared/lib/countries";
import { useTheme } from "@/shared/styles/theme";
import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";

/*
 * The OF1–OF4 controls (Claude Design FIGHTER 2): the 20 pt choice card with
 * a radio ring or a check box, the three-way stance switch, the weight-class
 * chip and the country field with its searchable list. Selection is shown by
 * shape and weight as well as colour, and announced as checked.
 */

/** OF2 / OF3 choice card: title, line, an optional badge, and a radio ring or a check box. */
export function ChoiceCard({
  title,
  body,
  checked,
  multiple = false,
  badge,
  onPress,
  disabled = false,
}: {
  title: string;
  body: string;
  checked: boolean;
  multiple?: boolean;
  badge?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityLabel={title}
      accessibilityHint={body}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-touch flex-row items-center gap-3 rounded-2xl px-4 py-3.5 ${checked ? "border-[1.5px] border-highlight bg-accent" : "border border-border bg-surface"}`}
    >
      <View className="flex-1 gap-0.5">
        <Text
          variant="bodyLg"
          weight="extrabold"
          color={checked ? "accentForeground" : "foreground"}
        >
          {title}
        </Text>
        <Text variant="caption" color={checked ? "accentMutedForeground" : "mutedForeground"}>
          {body}
        </Text>
      </View>
      {badge}
      {multiple ? (
        <View
          className={`size-5.5 items-center justify-center rounded-xs ${checked ? "bg-highlight" : "border-2 border-border-strong"}`}
        >
          {checked ? <Icon icon={Check} size={14} color="highlightForeground" /> : null}
        </View>
      ) : (
        <View
          className={`size-5.5 items-center justify-center rounded-full border-2 ${checked ? "border-highlight" : "border-border-strong"}`}
        >
          {checked ? <View className="size-2.5 rounded-full bg-highlight" /> : null}
        </View>
      )}
    </Pressable>
  );
}

/** OF2 stance: three equal segments in a pill well; none chosen until the person picks. */
export function SegmentChoice<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string | undefined;
}) {
  return (
    <View className="gap-2">
      <Text variant="label" color="faintForeground">
        {label}
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        className={`flex-row gap-1 rounded-3xl bg-surface p-1 ${error ? "border-2 border-destructive" : "border border-border"}`}
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked }}
              onPress={() => onChange(option.value)}
              className={`min-h-9 flex-1 items-center justify-center rounded-full ${checked ? "bg-secondary" : ""}`}
            >
              <Text
                variant="caption"
                weight={checked ? "extrabold" : "bold"}
                color={checked ? "secondaryForeground" : "mutedForeground"}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

/** OF4 weight-class chip (40 pt). */
export function Chip({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onPress}
      hitSlop={4}
      className={`h-10 flex-row items-center gap-1.5 rounded-full px-3.5 ${checked ? "border-[1.5px] border-primary-muted bg-accent" : "border border-input"}`}
    >
      {checked ? <Icon icon={Check} size={14} color="accentForeground" /> : null}
      <Text
        variant="bodySm"
        weight={checked ? "extrabold" : "bold"}
        color={checked ? "accentForeground" : "mutedForeground"}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A validation message, announced when it appears. */
export function FieldError({ message }: { message: string }) {
  return (
    <Text
      variant="caption"
      color="destructive"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {message}
    </Text>
  );
}

/**
 * OF1 country: a field that opens the searchable list of the 249 officially
 * assigned ISO codes, named in the reader's language; only the code is kept.
 */
export function CountryField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string | null;
  onChange: (code: string) => void;
  error?: string | undefined;
}) {
  const t = useTranslations("fighterOnboarding.country");
  const locale = useLocale();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = useMemo(() => countryOptions(locale), [locale]);
  const results = useMemo(() => searchCountries(options, query), [options, query]);

  return (
    <View className="flex-1 gap-1.5">
      <Text variant="caption" weight="bold" color="mutedForeground">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value === null ? t("none") : countryName(value, locale) }}
        accessibilityHint={t("hint")}
        onPress={() => setOpen(true)}
        className={`min-h-field flex-row items-center gap-2 rounded-lg bg-surface px-4 ${error ? "border-2 border-destructive" : "border border-border"}`}
      >
        <Text
          variant="bodyLg"
          weight="semibold"
          color={value === null ? "faintForeground" : "foreground"}
          numberOfLines={1}
          className="flex-1"
        >
          {value === null ? t("placeholder") : countryName(value, locale)}
        </Text>
        <Icon icon={ChevronDown} size={18} color="faintForeground" />
      </Pressable>
      {error ? <FieldError message={error} /> : null}
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 gap-3 bg-background px-5 pt-5">
          <View className="flex-row items-center justify-between">
            <Text variant="h3" accessibilityRole="header">
              {t("title")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("close")}
              onPress={() => setOpen(false)}
              className="size-11 items-center justify-center rounded-full border border-border bg-surface"
            >
              <Icon icon={X} size={18} />
            </Pressable>
          </View>
          <View className="min-h-field flex-row items-center gap-2.5 rounded-lg border-[1.5px] border-primary bg-surface px-4">
            <Icon icon={Search} size={18} color="faintForeground" />
            <TextInput
              accessibilityLabel={t("search")}
              placeholder={t("search")}
              placeholderTextColor={colors.faintForeground}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
              className="flex-1 font-sans-semibold text-body-lg text-foreground"
            />
          </View>
          <FlatList
            data={results}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            // Runtime inset: the list ends above the home indicator.
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            ListEmptyComponent={
              <Text color="mutedForeground" className="py-4">
                {t("empty")}
              </Text>
            }
            renderItem={({ item }) => {
              const checked = item.code === value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel={item.name}
                  accessibilityState={{ checked }}
                  onPress={() => {
                    onChange(item.code);
                    setQuery("");
                    setOpen(false);
                  }}
                  className="min-h-touch flex-row items-center gap-3 border-b border-border py-2"
                >
                  <Text weight={checked ? "extrabold" : "semibold"} className="flex-1">
                    {item.name}
                  </Text>
                  {checked ? <Icon icon={Check} size={18} color="highlight" /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}
