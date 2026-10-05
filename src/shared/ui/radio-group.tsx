import { Circle, CircleDot } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "./icon";
import { Text } from "./text";

export type RadioOption<T extends string> = {
  value: T;
  label: string;
  /** Secondary line, e.g. the current device language. */
  description?: string;
  /** BCP 47 tag when the label is in another language (screen reader pronunciation). */
  lang?: string;
};

/**
 * Single-choice list. The group is a labelled container (not itself focusable,
 * so each option stays individually reachable by VoiceOver/TalkBack). Each row
 * is a radio with checked state; selection is shown by an icon and weight,
 * not colour alone.
 */
export function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} className="gap-1">
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            accessibilityLabel={
              option.description ? `${option.label}, ${option.description}` : option.label
            }
            accessibilityLanguage={option.lang}
            onPress={() => onChange(option.value)}
            className={`min-h-touch flex-row items-center gap-3 rounded-md px-3 py-2 active:bg-muted ${checked ? "bg-muted" : ""}`}
          >
            <Icon
              icon={checked ? CircleDot : Circle}
              color={checked ? "primary" : "mutedForeground"}
            />
            <View className="flex-1">
              <Text weight={checked ? "extrabold" : "bold"}>{option.label}</Text>
              {option.description ? (
                <Text variant="caption" color="faintForeground">
                  {option.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
