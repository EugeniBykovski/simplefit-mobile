import { Check, CircleAlert, CircleCheck, Clock, Compass, WifiOff } from "lucide-react-native";
import type { Ref } from "react";
import { View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";

import type { GymChecklistItem, GymFirstRun } from "@/entities/gym-first-run";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { Sheet } from "@/shared/ui/sheet";
import { Skeleton } from "@/shared/ui/skeleton";
import { Text } from "@/shared/ui/text";

/*
 * GR1 (SF-92; Claude Design 112, `FirstRunGPulse`): the owner's introduction
 * and the gym's opening checklist on Gym pulse, from the SF-90 first-run
 * answer only. Nothing here is derived, counted or linked.
 */

type Measurable = Ref<View>;

/** The introduction card: start or resume, or skip; its pending and failed states. */
export function FirstRunIntro({
  firstRun,
  pending,
  failed,
  onStart,
  onSkip,
}: {
  firstRun: GymFirstRun;
  pending: boolean;
  failed: boolean;
  onStart: () => void;
  onSkip: () => void;
}) {
  const t = useTranslations("gymShell.firstRun.intro");
  const format = useFormatter();

  if (firstRun.status === "completed" || firstRun.status === "dismissed") {
    const outcome = firstRun.status;
    return (
      <View accessibilityRole="alert" testID={`first-run-outcome-${outcome}`}>
        <Notice tone={outcome === "completed" ? "olive" : "muted"} icon={CircleCheck}>
          {`${t(`${outcome}.title`)} ${t(`${outcome}.body`)}`}
        </Notice>
      </View>
    );
  }

  const resuming = firstRun.status === "in_progress";
  const started =
    firstRun.started_at === null
      ? undefined
      : format.dateTime(new Date(firstRun.started_at), { month: "short", day: "numeric" });

  return (
    <View
      testID={`first-run-intro-${firstRun.status}`}
      className="gap-3.5 rounded-3xl border border-accent-border bg-accent px-4 py-4"
    >
      <View className="flex-row gap-3">
        <View
          className="size-10 items-center justify-center rounded-2xl bg-primary"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Icon icon={Compass} size={18} color="primaryForeground" />
        </View>
        <View className="flex-1 gap-1">
          <Text variant="label" color="accentForeground">
            {resuming ? t("eyebrowInProgress") : t("eyebrow")}
          </Text>
          <Text variant="title" accessibilityRole="header" className="font-display">
            {resuming ? t("resumeTitle") : t("title")}
          </Text>
          <Text variant="bodySm" color="accentForeground">
            {failed
              ? t("failedBody")
              : resuming
                ? started === undefined
                  ? t("resumeBodyUndated")
                  : t("resumeBody", { date: started })
                : t("body")}
          </Text>
        </View>
      </View>
      {failed ? (
        <View accessibilityRole="alert">
          <Notice tone="amber" icon={CircleAlert}>
            {t("failed")}
          </Notice>
        </View>
      ) : null}
      <View className="flex-row flex-wrap gap-2.5">
        <View className="flex-grow">
          <Button
            label={
              pending ? t("starting") : failed ? t("retry") : resuming ? t("resume") : t("start")
            }
            loading={pending}
            onPress={onStart}
            testID="first-run-start"
          />
        </View>
        <View className="flex-grow">
          <Button label={t("skip")} variant="quiet" disabled={pending} onPress={onSkip} />
        </View>
      </View>
    </View>
  );
}

/** The introduction and checklist while they load. */
export function FirstRunLoading() {
  const t = useTranslations("gymShell.firstRun");
  return (
    <View className="gap-4" accessible accessibilityLabel={t("loading")}>
      <View className="gap-2.5 rounded-3xl border border-border bg-surface px-4 py-4">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-11 w-full" />
      </View>
      <View className="gap-2.5 rounded-3xl border border-border bg-surface px-4 py-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </View>
    </View>
  );
}

/** The read failed or the phone is offline: Gym pulse works without it. */
export function FirstRunUnavailable({
  offline,
  onRetry,
}: {
  offline: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("gymShell.firstRun.unavailable");
  return (
    <View
      testID="first-run-unavailable"
      className="gap-3 rounded-3xl border border-border bg-surface px-4 py-4"
    >
      <View accessibilityRole="alert">
        <Notice tone="amber" icon={offline ? WifiOff : CircleAlert}>
          {offline ? `${t("offlineTitle")} ${t("offlineBody")}` : `${t("title")} ${t("body")}`}
        </Notice>
      </View>
      <Button label={t("retry")} variant="quiet" onPress={onRetry} />
    </View>
  );
}

/**
 * The opening checklist exactly as the API answers it, in its order: done and
 * available items first under "Your gym is ready" (when `create_gym` is
 * done), then the items whose features do not exist yet under "More tools
 * are coming". No percentage or count; nothing is tappable.
 */
export function GymChecklist({
  items,
  targetRef,
}: {
  items: GymChecklistItem[];
  /** The GR2 step 1 spotlight target. */
  targetRef?: Measurable;
}) {
  const t = useTranslations("gymShell.firstRun.checklist");
  const now = items.filter((item) => item.status !== "coming_later");
  const later = items.filter((item) => item.status === "coming_later");
  const created = items.some((item) => item.key === "create_gym" && item.status === "completed");

  return (
    <View
      ref={targetRef}
      collapsable={false}
      testID="gym-checklist"
      className="gap-3.5 rounded-3xl border border-border bg-surface px-4 py-4"
    >
      <View className="gap-1">
        <Text variant="label" color="faintForeground">
          {t("eyebrow")}
        </Text>
        <Text variant="title" accessibilityRole="header" className="font-display">
          {created ? t("readyTitle") : t("title")}
        </Text>
        {created ? (
          <Text variant="bodySm" color="mutedForeground">
            {t("readyBody")}
          </Text>
        ) : null}
      </View>
      {now.length > 0 ? (
        <View className="gap-2">
          {now.map((item) => (
            <ChecklistRow key={item.key} item={item} />
          ))}
        </View>
      ) : null}
      {later.length > 0 ? (
        <View className="gap-1">
          <Text variant="label" color="faintForeground" accessibilityRole="header">
            {t("moreTitle")}
          </Text>
          <Text variant="caption" color="mutedForeground">
            {t("moreBody")}
          </Text>
          <View className="mt-1.5">
            {later.map((item, position) => (
              <ChecklistRow key={item.key} item={item} divided={position > 0} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ChecklistRow({ item, divided = false }: { item: GymChecklistItem; divided?: boolean }) {
  const t = useTranslations("gymShell.firstRun.checklist");
  const title = t(`items.${item.key}.title`);
  const line = t(`items.${item.key}.${item.status}`);
  const badge = t(`badges.${item.status}`);
  const done = item.status === "completed";
  const later = item.status === "coming_later";

  return (
    <View
      accessible
      accessibilityLabel={`${title}, ${line}, ${badge}`}
      accessibilityState={{ disabled: later, checked: done }}
      testID={`checklist-${item.key}-${item.status}`}
      className={
        later
          ? `min-h-14 flex-row items-center gap-3 py-2 ${divided ? "border-t border-border" : ""}`
          : `min-h-14 flex-row items-center gap-3 rounded-2xl border px-3 py-2.5 ${done ? "border-accent-border bg-accent" : "border-border bg-surface-elevated"}`
      }
    >
      <View
        className={`size-7 items-center justify-center rounded-full ${done ? "bg-primary" : "border border-border-strong"}`}
      >
        <Icon
          icon={done ? Check : Clock}
          size={14}
          color={done ? "primaryForeground" : "faintForeground"}
        />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="bodySm" weight="extrabold" color={later ? "mutedForeground" : undefined}>
          {title}
        </Text>
        <Text variant="caption" color={done ? "accentForeground" : "mutedForeground"}>
          {line}
        </Text>
      </View>
      <Badge variant={done ? "accent" : "neutral"} label={badge} />
    </View>
  );
}

/** "Skip the introduction?" as a bottom sheet (artboard `skip_confirm`). */
export function SkipSheet({
  visible,
  pending,
  failed,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  pending: boolean;
  failed: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("gymShell.firstRun.skip");
  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={t("title")}
      description={t("body")}
      closeLabel={t("keep")}
      dismissible={!pending}
      role="alert"
    >
      {failed ? (
        <View accessibilityRole="alert">
          <Notice tone="amber" icon={CircleAlert}>
            {t("failed")}
          </Notice>
        </View>
      ) : null}
      <Button label={t("confirm")} variant="warning" loading={pending} onPress={onConfirm} />
      <Button label={t("keep")} variant="quiet" disabled={pending} onPress={onCancel} />
    </Sheet>
  );
}
