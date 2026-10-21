import { useNavigation, useRouter } from "expo-router";
import { CircleAlert, Info, Lock, TriangleAlert } from "lucide-react-native";
import { useLayoutEffect, useState } from "react";
import { View } from "react-native";
import { useFormatter, useTimeZone, useTranslations } from "use-intl";

import {
  isUnavailable,
  useMyTrainingSession,
  type MyTrainingSession,
} from "@/entities/training-session";
import { CompleteSessionButton, type CompleteOutcome } from "@/features/training-session-complete";
import { formatOffset, zoneOffsetMinutes } from "@/shared/lib/time-zone";
import { routeHref } from "@/shared/routes/routes";
import { Button } from "@/shared/ui/button";
import { Notice } from "@/shared/ui/notice";
import { Screen } from "@/shared/ui/screen";
import { Spinner } from "@/shared/ui/spinner";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";

import { Message, StatusBadge, useCoachLine } from "./parts";

/*
 * FT2 Session (`mobile.sessions._session-id`, SF-66; Claude Design
 * SessionDetail.dc.html screen=detail, version 1792569354-73b2). One of the
 * fighter's own sessions from `getMyTrainingSession`: the coach's public
 * identity (or the name at the end of the relationship), type, the start in
 * the session's zone with its offset and in the viewer's, duration, the
 * coach's notes, the backend status and, once it ended, the completion time
 * or the cancellation. "Mark as completed" only while planned, behind a
 * confirmation; the backend decides whether it has started and sets
 * `completed_at`. Completed and cancelled sessions are read-only. No block
 * plan, timer or result: F04's plan and F05/F06 are FUTURE.
 */

const WHEN = {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
} as const;

export function FighterSessionScreen({ sessionId }: { sessionId: string }) {
  const t = useTranslations("fighterTraining");
  const navigation = useNavigation();
  const title = useTranslations("routes.titles")("mobile/sessions/_session-id");
  const query = useMyTrainingSession(sessionId);

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  // A session already shown stays on screen when reading it again fails
  // (offline): the backend's last answer, never an error instead of it. Only
  // the backend saying it is gone (404) replaces it.
  if (query.data && !(query.isError && isUnavailable(query.error)))
    return <Detail session={query.data} />;
  if (query.isError && !isUnavailable(query.error)) {
    return (
      <Screen>
        <View accessibilityRole="alert" testID="training-session:failed">
          <Notice tone="coral" icon={CircleAlert}>
            {`${t("detail.failed.title")} ${t("detail.failed.body")}`}
          </Notice>
        </View>
        <Button label={t("failed.retry")} variant="quiet" onPress={() => void query.refetch()} />
      </Screen>
    );
  }
  if (query.isError || query.data === null) return <NotAvailable />;
  if (query.data === undefined) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <Spinner label={t("detail.loading")} />
        </View>
      </Screen>
    );
  }
  return <Detail session={query.data} />;
}

function NotAvailable() {
  const t = useTranslations("fighterTraining");
  const router = useRouter();
  return (
    <Screen>
      <Message
        icon={Lock}
        title={t("detail.missing.title")}
        body={t("detail.missing.body")}
        testID="training-session:unavailable"
      />
      <Button
        label={t("back")}
        variant="quiet"
        onPress={() => router.replace(routeHref("mobile.training"))}
      />
    </Screen>
  );
}

type Refusal = "notStarted" | "cancelled";

function Detail({ session }: { session: MyTrainingSession }) {
  const t = useTranslations("fighterTraining");
  const format = useFormatter();
  const viewerZone = useTimeZone() ?? "UTC";
  const toast = useToast();
  const coachLine = useCoachLine();
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const start = new Date(session.starts_at);
  const coach = coachLine(session);
  const ended = session.coach === null;
  const sameZone =
    viewerZone === session.time_zone ||
    zoneOffsetMinutes(viewerZone, start) === zoneOffsetMinutes(session.time_zone, start);

  const facts: [string, string][] = [
    [t("detail.facts.coach"), coach.line],
    [t("detail.facts.type"), t(`types.${session.training_type}`)],
    [
      t("detail.facts.starts"),
      t("detail.startsValue", {
        when: format.dateTime(start, { ...WHEN, timeZone: session.time_zone }),
        zone: session.time_zone,
        offset: formatOffset(zoneOffsetMinutes(session.time_zone, start)),
      }),
    ],
    [
      t("detail.facts.yourTime"),
      sameZone
        ? t("detail.sameZone", {
            time: format.dateTime(start, {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: viewerZone,
            }),
          })
        : t("detail.otherZone", {
            when: format.dateTime(start, { ...WHEN, timeZone: viewerZone }),
            zone: viewerZone,
          }),
    ],
    [t("detail.facts.duration"), t("list.minutes", { minutes: session.duration_minutes })],
    [t("detail.facts.notes"), session.notes ?? t("detail.noNotes")],
  ];
  if (session.status === "completed" && session.completed_at !== null) {
    facts.push([
      t("detail.facts.completed"),
      format.dateTime(new Date(session.completed_at), WHEN),
    ]);
  }
  if (session.status === "cancelled" && session.cancelled_at !== null) {
    const when = format.dateTime(new Date(session.cancelled_at), WHEN);
    facts.push([
      t("detail.facts.cancelled"),
      session.cancelled_by === "system"
        ? t("detail.cancelledBySystem", { when })
        : t("detail.cancelledByCoach", { when }),
    ]);
  }

  const aside =
    session.status === "planned"
      ? ended
        ? t("detail.aside.ended")
        : t("detail.aside.planned")
      : t(`detail.aside.${session.status}`);

  const done = (outcome: CompleteOutcome) => {
    // Only the backend's answer is shown; the page then renders the session it returned.
    if (outcome.kind === "completed") {
      setRefusal(null);
      toast.show({ title: t("complete.done"), tone: "success" });
    } else if (outcome.kind === "notStarted") setRefusal("notStarted");
    else if (outcome.kind === "cancelled") setRefusal("cancelled");
    else toast.show({ title: t("complete.unavailable") });
  };

  return (
    <Screen>
      <View className="gap-2" testID={`training-session:${session.status}`}>
        <StatusBadge status={session.status} />
        <Text variant="h2" accessibilityRole="header">
          {session.title}
        </Text>
      </View>

      <View className="rounded-3xl border border-border bg-surface px-4 py-1">
        {facts.map(([label, value], index) => (
          <View
            key={label}
            accessible
            accessibilityLabel={`${label}: ${value}`}
            className={`gap-1 py-3 ${index === 0 ? "" : "border-t border-border"}`}
          >
            <Text variant="caption" color="faintForeground">
              {label}
            </Text>
            <Text variant="bodySm" weight="bold">
              {value}
            </Text>
          </View>
        ))}
      </View>

      {refusal !== null && session.status !== "completed" ? (
        <View accessibilityRole="alert" testID={`training-session:refused:${refusal}`}>
          <Notice tone="amber" icon={TriangleAlert}>
            {`${t(`complete.refused.${refusal}.title`)} ${t(`complete.refused.${refusal}.body`)}`}
          </Notice>
        </View>
      ) : null}

      <Notice tone="muted" icon={Info}>
        {aside}
      </Notice>

      {session.status === "planned" ? (
        <CompleteSessionButton sessionId={session.id} coachName={coach.name} onDone={done} />
      ) : null}
    </Screen>
  );
}
