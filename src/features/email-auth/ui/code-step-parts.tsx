import {
  Check,
  Clock,
  Lock,
  Mail,
  RefreshCw,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useTranslations } from "use-intl";

import { Notice, type NoticeTone } from "@/shared/ui/notice";
import { Text } from "@/shared/ui/text";

import { formatCountdown, type CodeStepStatus, type Purpose } from "../model/code-step";

const NOTICES: Partial<Record<CodeStepStatus, { tone: NoticeTone; icon: LucideIcon }>> = {
  sent: { tone: "olive", icon: Mail },
  resent: { tone: "olive", icon: RefreshCw },
  invalid: { tone: "coral", icon: TriangleAlert },
  expired: { tone: "amber", icon: Clock },
  success: { tone: "olive", icon: Check },
  throttled: { tone: "coral", icon: TriangleAlert },
  error: { tone: "coral", icon: TriangleAlert },
  "verified-elsewhere": { tone: "amber", icon: Lock },
};

/** The status message of the step (olive, amber or coral), announced politely. */
export function StatusNotice({
  purpose,
  status,
  email,
}: {
  purpose: Purpose;
  status: CodeStepStatus;
  email: string;
}) {
  const t = useTranslations(purpose === "sign-in" ? "auth.code.signIn" : "auth.code.registration");
  const notice = NOTICES[status];
  if (!notice) return null;
  return (
    <Notice tone={notice.tone} icon={notice.icon} live>
      {t(`notices.${status}` as "notices.invalid", { email })}
    </Notice>
  );
}

/** "Didn't get it? … Resend in 0:42", or the "Send a new code" action once allowed. */
export function ResendRow({
  status,
  secondsUntilResend,
  canResend,
  onResend,
}: {
  status: CodeStepStatus;
  secondsUntilResend: number;
  canResend: boolean;
  onResend: () => void;
}) {
  const t = useTranslations("auth.code");
  return (
    <View className="min-h-touch flex-row items-center justify-between gap-2.5">
      <Text variant="bodySm" color="mutedForeground">
        {t("didntGetIt")}
      </Text>
      {status === "throttled" ? (
        <Text variant="bodySm" color="faintForeground">
          {t("resendUnavailable")}
        </Text>
      ) : canResend ? (
        <Pressable
          accessibilityRole="button"
          onPress={onResend}
          hitSlop={8}
          className="min-h-touch justify-center"
        >
          <Text variant="bodySm" weight="extrabold" color="highlight">
            {t("sendNewCode")}
          </Text>
        </Pressable>
      ) : (
        <Text variant="bodySm" color="faintForeground">
          {t("resendIn", { time: formatCountdown(secondsUntilResend) })}
        </Text>
      )}
    </View>
  );
}

export type CtaAction = "submit" | "resend" | "retry" | "handoff" | "none";
export type CtaLabel = "submit" | "submitting" | "continue" | "sendNewCode" | "tryAgain";

/** The primary action of each status (the artboards' state tables). */
export function ctaFor(
  status: CodeStepStatus,
  codeComplete: boolean,
): { action: CtaAction; label: CtaLabel; disabled: boolean } {
  switch (status) {
    case "submitting":
      return { action: "none", label: "submitting", disabled: true };
    case "success":
      return { action: "none", label: "continue", disabled: true };
    case "expired":
      return { action: "resend", label: "sendNewCode", disabled: false };
    case "verified-elsewhere":
      return { action: "handoff", label: "sendNewCode", disabled: false };
    case "error":
      return { action: "retry", label: "tryAgain", disabled: false };
    case "throttled":
      return { action: "none", label: "submit", disabled: true };
    default:
      return { action: "submit", label: "submit", disabled: !codeComplete };
  }
}
