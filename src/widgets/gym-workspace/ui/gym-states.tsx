import { useRouter } from "expo-router";
import { Lock, SearchX, Wrench, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";

import type { Gym } from "@/entities/gym";
import { SignOutButton } from "@/features/sign-out";
import { routeHref } from "@/shared/routes/routes";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";

/**
 * A gym shell state: the gate covers the shell (tab bar included) with one
 * message card, inside the safe area. The way out is an action of the state
 * and Sign out, so nobody is stuck in a gym they cannot open.
 */
function StateScreen({
  role = "summary",
  icon,
  eyebrow,
  title,
  body,
  action,
}: {
  role?: "summary" | "alert";
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 justify-center gap-4 bg-background px-5"
      // Runtime safe-area insets: the state covers the whole shell.
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View
        accessibilityRole={role}
        accessibilityLiveRegion="polite"
        className="gap-3 rounded-3xl border border-border bg-surface p-5"
      >
        <View className="size-12 items-center justify-center rounded-xl bg-accent">
          <Icon icon={icon} size={20} color="highlight" />
        </View>
        <Text variant="label" color="faintForeground">
          {eyebrow}
        </Text>
        <Text variant="h3" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="bodySm" color="mutedForeground">
          {body}
        </Text>
        {action}
      </View>
      <SignOutButton variant="ghost" />
    </View>
  );
}

/**
 * Not available (route rule 9): the gym is unknown, someone else's, or the
 * user's membership ended. The backend answers all of them with 404, and so
 * does this state: it never says which, nor that the gym exists. The way out
 * is the user's own gyms.
 */
export function GymNotAvailable() {
  const t = useTranslations("gymShell.states");
  const router = useRouter();
  return (
    <StateScreen
      icon={SearchX}
      eyebrow={t("eyebrow")}
      title={t("notAvailable.title")}
      body={t("notAvailable.body")}
      action={
        <Button
          label={t("notAvailable.action")}
          variant="quiet"
          onPress={() => router.replace(routeHref("mobile.gyms"))}
        />
      }
    />
  );
}

/**
 * Role-restricted (403, ADR 0026 D-G24): the user works at this gym, but
 * their role does not include what the screen needs. It names no other
 * role's data, offers the gym's Gym pulse, and is never retried.
 */
export function GymRestricted({ gymId }: { gymId: string }) {
  const t = useTranslations("gymShell.states");
  const router = useRouter();
  return (
    <StateScreen
      icon={Lock}
      eyebrow={t("eyebrow")}
      title={t("restricted.title")}
      body={t("restricted.body")}
      action={
        <Button
          label={t("restricted.action")}
          variant="quiet"
          onPress={() => router.replace(routeHref("mobile.gyms._gym-id.pulse", { gymId }))}
        />
      }
    />
  );
}

/**
 * A draft gym (setup not completed) is never an operational workspace: no
 * gym screen renders for it. The owner continues setup, which resumes this
 * draft (the backend's `complete_setup` permission is the owner's).
 */
export function GymDraftState({ gym }: { gym: Gym }) {
  const t = useTranslations("gymShell.states");
  const router = useRouter();
  const canContinue = gym.viewer.permissions.includes("complete_setup");
  return (
    <StateScreen
      icon={Wrench}
      eyebrow={gym.name}
      title={t("draft.title")}
      body={canContinue ? t("draft.body") : t("draft.bodyStaff")}
      action={
        canContinue ? (
          <Button
            label={t("draft.action")}
            onPress={() =>
              router.replace(routeHref("mobile.onboarding.gym", {}, { intent: "gym" }))
            }
          />
        ) : undefined
      }
    />
  );
}
