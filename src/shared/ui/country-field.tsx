import { Check, ChevronDown, Search, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "use-intl";

import { countryName, countryOptions, searchCountries } from "@/shared/lib/countries";
import { useTheme } from "@/shared/styles/theme";

import { FieldError } from "./field-error";
import { Icon } from "./icon";
import { Text } from "./text";

/** The country field's words, from the screen's catalog. */
export type CountryFieldCopy = {
  placeholder: string;
  none: string;
  hint: string;
  title: string;
  close: string;
  search: string;
  empty: string;
};

/**
 * The registration country field (Claude Design OF1, OC1): opens the
 * searchable list of the 249 officially assigned ISO codes, named in the
 * reader's language; only the code is kept.
 */
export function CountryField({
  label,
  copy: t,
  value,
  onChange,
  error,
}: {
  label: string;
  copy: CountryFieldCopy;
  value: string | null;
  onChange: (code: string) => void;
  error?: string | undefined;
}) {
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
        accessibilityValue={{ text: value === null ? t.none : countryName(value, locale) }}
        accessibilityHint={t.hint}
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
          {value === null ? t.placeholder : countryName(value, locale)}
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
              {t.title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.close}
              onPress={() => setOpen(false)}
              className="size-11 items-center justify-center rounded-full border border-border bg-surface"
            >
              <Icon icon={X} size={18} />
            </Pressable>
          </View>
          <View className="min-h-field flex-row items-center gap-2.5 rounded-lg border-[1.5px] border-primary bg-surface px-4">
            <Icon icon={Search} size={18} color="faintForeground" />
            <TextInput
              accessibilityLabel={t.search}
              placeholder={t.search}
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
                {t.empty}
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
