import { Check, ChevronRight, Plus } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useTranslations } from "use-intl";

import { Icon } from "@/shared/ui/icon";
import { Spinner } from "@/shared/ui/spinner";
import { Text } from "@/shared/ui/text";

/**
 * The avatar of an A04 row (Claude Design Workspaces, 1792675284-1046): a
 * completed profile (round, its colour), a gym (the G01 identity tile: a
 * rounded square), a journey (dashed, plus) or a link to more rows.
 */
export type RowAvatar =
  { kind: "fighter" | "coach" | "gym"; initials: string } | { kind: "journey" } | { kind: "more" };

const AVATAR: Record<
  "fighter" | "coach" | "gym",
  { wrap: string; text: "highlightForeground" | "warningForeground" | "primaryForeground" }
> = {
  fighter: { wrap: "rounded-full bg-highlight", text: "highlightForeground" },
  coach: { wrap: "rounded-full bg-warning", text: "warningForeground" },
  gym: { wrap: "rounded-xl bg-primary", text: "primaryForeground" },
};

/**
 * One row of the A04 chooser and of the gym chooser (MGC1): avatar, title,
 * line, and the current check or the opening state. While another row opens
 * every row is disabled and dimmed.
 */
export function ChooserRow({
  title,
  line,
  avatar,
  current = false,
  opening = false,
  pending = false,
  onPress,
}: {
  title: string;
  line: string;
  avatar: RowAvatar;
  current?: boolean;
  opening?: boolean;
  pending?: boolean;
  onPress: () => void;
}) {
  const t = useTranslations("contextSwitcher");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${line}`}
      accessibilityState={{ selected: current, disabled: pending, busy: opening }}
      disabled={pending}
      onPress={onPress}
      className={`min-h-16 flex-row items-center gap-3 rounded-2xl border px-3.5 py-2.5 ${
        current ? "border-primary bg-surface-elevated" : "border-border"
      } ${pending && !opening ? "opacity-50" : ""}`}
    >
      <Avatar avatar={avatar} />
      <View className="flex-1 gap-0.5">
        <Text variant="body" weight="extrabold">
          {title}
        </Text>
        <Text variant="label" color={current ? "highlight" : "faintForeground"}>
          {line}
        </Text>
      </View>
      {opening ? (
        <View className="flex-row items-center gap-2">
          <Spinner label={t("opening")} />
          <Text variant="caption" weight="extrabold" color="highlight">
            {t("opening")}
          </Text>
        </View>
      ) : current ? (
        <View className="size-6.5 items-center justify-center rounded-full bg-primary">
          <Icon icon={Check} size={14} color="primaryForeground" />
        </View>
      ) : avatar.kind === "more" ? (
        <Icon icon={ChevronRight} size={16} color="faintForeground" />
      ) : null}
    </Pressable>
  );
}

function Avatar({ avatar }: { avatar: RowAvatar }) {
  if (avatar.kind === "journey" || avatar.kind === "more") {
    return (
      <View className="size-10 items-center justify-center rounded-full border-[1.5px] border-dashed border-accent-border">
        <Icon icon={avatar.kind === "more" ? ChevronRight : Plus} size={18} color="highlight" />
      </View>
    );
  }
  const tone = AVATAR[avatar.kind];
  return (
    <View className={`size-10 items-center justify-center ${tone.wrap}`}>
      <Text variant="caption" weight="bold" color={tone.text} className="font-display-bold">
        {avatar.initials}
      </Text>
    </View>
  );
}
