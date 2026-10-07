import { CircleAlert, Lock, ServerOff, WifiOff, type LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import type { SemanticColors } from "@/shared/styles/tokens";
import { Button, type ButtonVariant } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Text, type TextColor } from "@/shared/ui/text";

import { isRetryable, type FailureKind } from "../model/failure";

const TONES: Record<
  FailureKind,
  {
    icon: LucideIcon;
    card: string;
    tag: TextColor;
    iconWrap: string;
    iconColor: keyof SemanticColors;
    action: ButtonVariant;
  }
> = {
  unexpected: {
    icon: CircleAlert,
    card: "border-destructive-border",
    tag: "destructiveSubtleForeground",
    iconWrap: "bg-destructive-subtle",
    iconColor: "destructiveSubtleForeground",
    action: "destructiveSubtle",
  },
  offline: {
    icon: WifiOff,
    card: "border-warning-subtle",
    tag: "warning",
    iconWrap: "bg-warning-subtle",
    iconColor: "warning",
    action: "primary",
  },
  forbidden: {
    icon: Lock,
    card: "border-warning-subtle",
    tag: "warning",
    iconWrap: "bg-warning-subtle",
    iconColor: "warning",
    action: "primary",
  },
  unavailable: {
    icon: ServerOff,
    card: "border-border",
    tag: "faintForeground",
    iconWrap: "bg-muted",
    iconColor: "mutedForeground",
    action: "quiet",
  },
};

/**
 * A failure state card (Claude Design "System states" sheet): tone tag, icon
 * tile, title, explanation and one valid action. Never shows an error's
 * message or details. Retryable states call `onRetry`; the others lead home.
 */
export function ErrorState({
  kind,
  onRetry,
  onHome,
}: {
  kind: FailureKind;
  onRetry?: () => void;
  onHome: () => void;
}) {
  const t = useTranslations("errors.states");
  const actions = useTranslations("actions");
  const tone = TONES[kind];
  const retry = isRetryable(kind) ? onRetry : undefined;

  return (
    <View
      accessibilityRole="alert"
      className={`w-full gap-4 rounded-4xl border bg-background p-5 ${tone.card}`}
    >
      <Text variant="label" color={tone.tag}>
        {t(`${kind}.tag`)}
      </Text>
      <View className={`size-[52px] items-center justify-center rounded-xl ${tone.iconWrap}`}>
        <Icon icon={tone.icon} size={26} color={tone.iconColor} />
      </View>
      <View className="gap-1.5">
        <Text variant="h3">{t(`${kind}.title`)}</Text>
        <Text variant="bodySm" color="mutedForeground">
          {t(`${kind}.description`)}
        </Text>
      </View>
      {retry ? (
        <Button variant={tone.action} label={t(`${kind}.action`)} onPress={retry} />
      ) : (
        <Button
          variant={tone.action}
          label={kind === "forbidden" ? t("forbidden.action") : actions("backToHome")}
          onPress={onHome}
        />
      )}
    </View>
  );
}
