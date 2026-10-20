import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Check, ChevronRight, Search, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, TextInput, useWindowDimensions, View } from "react-native";

import { fromPickerValue, pickerValue } from "@/shared/lib/time-zone";
import { useTheme } from "@/shared/styles/theme";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Sheet } from "@/shared/ui/sheet";
import { Text } from "@/shared/ui/text";

/**
 * One row of the schedule card (CT2: Date, Start time, Time zone): a label,
 * the chosen value (or what to choose) and a chevron. Opens its picker.
 */
export function ScheduleRow({
  label,
  value,
  placeholder,
  hint,
  icon,
  invalid = false,
  disabled = false,
  last = false,
  onPress,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  hint: string;
  icon: LucideIcon;
  invalid?: boolean;
  disabled?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  // From accessibility text sizes on, the label goes above its value.
  const stacked = useWindowDimensions().fontScale >= 1.3;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value ?? placeholder}`}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-13 py-2 active:opacity-80 ${stacked ? "gap-1" : "flex-row items-center gap-3"} ${last ? "" : "border-b border-border"} ${disabled ? "opacity-50" : ""}`}
    >
      <View className={`flex-row items-center gap-3 ${stacked ? "" : "flex-1"}`}>
        <Icon icon={icon} size={18} color={invalid ? "destructive" : "faintForeground"} />
        <Text variant="bodySm" color="mutedForeground" className="flex-shrink">
          {label}
        </Text>
      </View>
      <View className={`flex-row items-center gap-3 ${stacked ? "" : "flex-shrink"}`}>
        <Text
          variant="bodySm"
          weight="extrabold"
          color={value === null ? "faintForeground" : "foreground"}
          className={stacked ? "flex-1" : "flex-shrink text-right"}
        >
          {value ?? placeholder}
        </Text>
        <Icon icon={ChevronRight} size={14} color="faintForeground" />
      </View>
    </Pressable>
  );
}

/**
 * The native date or time picker for a wall date / time. It runs in UTC so
 * the value it shows is the wall clock the coach means, whatever the
 * device's own zone (see `pickerValue`). iOS shows it inline in a sheet with
 * Done; Android opens its system dialog.
 */
export function useWallPicker({
  date,
  time,
  fallback,
  minimumDate,
  maximumDate,
  is24Hour,
  onPick,
}: {
  date: string;
  time: string;
  /** The wall date and time shown when none is chosen yet. */
  fallback: { date: string; time: string };
  minimumDate: string;
  maximumDate: string;
  is24Hour: boolean;
  onPick: (mode: "date" | "time", picked: { date: string; time: string }) => void;
}) {
  const [open, setOpen] = useState<"date" | "time" | null>(null);
  const value = pickerValue(date || fallback.date, time || fallback.time);
  const bounds = {
    minimumDate: pickerValue(minimumDate, "00:00"),
    maximumDate: pickerValue(maximumDate, "23:59"),
  };

  const show = (mode: "date" | "time") => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value,
        mode,
        is24Hour,
        timeZoneName: "UTC",
        ...(mode === "date" ? bounds : {}),
        onValueChange: (_event, picked) => onPick(mode, fromPickerValue(picked)),
      });
      return;
    }
    setOpen(mode);
  };

  return {
    open,
    value,
    bounds,
    show,
    pick: (picked: { date: string; time: string }) => {
      if (open !== null) onPick(open, picked);
    },
    close: () => setOpen(null),
  };
}

export function WallPickerSheet({
  mode,
  value,
  bounds,
  title,
  doneLabel,
  locale,
  onPick,
  onClose,
}: {
  mode: "date" | "time" | null;
  value: Date;
  bounds: { minimumDate: Date; maximumDate: Date };
  title: string;
  doneLabel: string;
  locale: string;
  onPick: (picked: { date: string; time: string }) => void;
  onClose: () => void;
}) {
  const { scheme } = useTheme();
  const [shown, setShown] = useState(value);
  const [opened, setOpened] = useState(mode);
  // A newly opened picker starts from the form's value.
  if (opened !== mode) {
    setOpened(mode);
    setShown(value);
  }
  if (Platform.OS === "android") return null;

  return (
    <Sheet visible={mode !== null} onClose={onClose} title={title} closeLabel={doneLabel}>
      {mode === null ? null : (
        <View className="items-center" testID={`session-form:picker:${mode}`}>
          <DateTimePicker
            value={shown}
            mode={mode}
            display={mode === "date" ? "inline" : "spinner"}
            timeZoneName="UTC"
            locale={locale}
            themeVariant={scheme}
            {...(mode === "date" ? bounds : {})}
            onValueChange={(_event, picked) => setShown(picked)}
          />
        </View>
      )}
      <Button
        label={doneLabel}
        size="lg"
        onPress={() => {
          onPick(fromPickerValue(shown));
          onClose();
        }}
      />
    </Sheet>
  );
}

export type Choice = { value: string; label: string; description?: string };

/**
 * A searchable single choice in a sheet (the fighter, the time zone). Shows
 * at most `limit` matches; the search narrows them.
 */
export function ChoiceSheet({
  visible,
  title,
  description,
  searchLabel,
  emptyLabel,
  moreLabel,
  closeLabel,
  choices,
  value,
  limit = 60,
  describe,
  onChoose,
  onClose,
}: {
  visible: boolean;
  title: string;
  description?: string;
  searchLabel: string;
  emptyLabel: string;
  moreLabel: string;
  closeLabel: string;
  choices: readonly Choice[];
  value: string;
  limit?: number;
  /** A secondary line computed only for the choices shown (e.g. a zone's offset). */
  describe?: (value: string) => string;
  onChoose: (value: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase().replace(/\s+/g, "_");
  const matches = choices.filter(
    (choice) =>
      needle === "" ||
      choice.value.toLowerCase().includes(needle) ||
      choice.label.toLowerCase().replace(/\s+/g, "_").includes(needle),
  );
  const shown = matches
    .slice(0, limit)
    .map((choice) =>
      describe === undefined ? choice : { ...choice, description: describe(choice.value) },
    );

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setQuery("");
        onClose();
      }}
      title={title}
      {...(description === undefined ? {} : { description })}
      closeLabel={closeLabel}
    >
      <View className="min-h-field flex-row items-center gap-2 rounded-lg border border-border bg-background px-3.5">
        <Icon icon={Search} size={16} color="faintForeground" />
        <TextInput
          accessibilityLabel={searchLabel}
          placeholder={searchLabel}
          // Native prop: cannot be expressed as a className.
          placeholderTextColor={colors.faintForeground}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          maxFontSizeMultiplier={2}
          className="flex-1 py-3 font-sans-semibold text-body text-foreground"
        />
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={title}>
        {shown.map((choice) => {
          const checked = choice.value === value;
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              accessibilityLabel={
                choice.description ? `${choice.label}, ${choice.description}` : choice.label
              }
              onPress={() => {
                setQuery("");
                onChoose(choice.value);
              }}
              className="min-h-13 flex-row items-center gap-3 border-t border-border py-2 active:bg-muted"
            >
              <View className="flex-1 gap-0.5">
                <Text variant="bodySm" weight="extrabold">
                  {choice.label}
                </Text>
                {choice.description ? (
                  <Text variant="caption" color="faintForeground">
                    {choice.description}
                  </Text>
                ) : null}
              </View>
              {checked ? <Icon icon={Check} size={18} color="highlight" /> : null}
            </Pressable>
          );
        })}
      </View>
      {shown.length === 0 ? (
        <Text variant="bodySm" color="mutedForeground" accessibilityLiveRegion="polite">
          {emptyLabel}
        </Text>
      ) : matches.length > shown.length ? (
        <Text variant="caption" color="faintForeground">
          {moreLabel}
        </Text>
      ) : null}
    </Sheet>
  );
}
