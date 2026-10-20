import { useRouter } from "expo-router";
import { CircleAlert, Info, Lock } from "lucide-react-native";
import { View } from "react-native";
import { useFormatter, useTimeZone, useTranslations } from "use-intl";

import {
  fighterLabel,
  isUnavailable,
  useCoachTrainingSession,
  type CoachTrainingSession,
} from "@/entities/training-session";
import { CancelSessionButton, type CancelOutcome } from "@/features/training-session-cancel";
import { formatOffset, zoneOffsetMinutes } from "@/shared/lib/time-zone";
import { routeHref } from "@/shared/routes/routes";
import { Button } from "@/shared/ui/button";
import { Notice } from "@/shared/ui/notice";
import { Screen } from "@/shared/ui/screen";
import { Spinner } from "@/shared/ui/spinner";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";

import { Message, StatusBadge } from "./parts";
import { useScreenTitle } from "./use-screen-title";

/*
 * CT3 Session (`mobile.coach.sessions._session-id`, SF-65; Claude Design
 * SessionControl.dc.html screen=detail, version 1792504884-2e4e). One
 * session from `getMyCoachTrainingSession`: its backend status, the start in
 * the session's own zone (with its offset then) and in the viewer's, and,
 * once it ended, when the fighter completed it or who cancelled it. Edit and
 * Cancel session only while planned; a completed or cancelled session is
 * read-only. Unknown, foreign and ended sessions are one not-available state.
 */

const WHEN = {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
} as const;

export function CoachSessionScreen({ sessionId }: { sessionId: string }) {
  const t = useTranslations("coachSessions");
  const query = useCoachTrainingSession(sessionId);
  useScreenTitle("mobile/coach/sessions/_session-id");

  if (query.isError && !isUnavailable(query.error)) {
    return (
      <Screen>
        <View accessibilityRole="alert" testID="session:failed">
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
  const t = useTranslations("coachSessions");
  const router = useRouter();
  return (
    <Screen>
      <Message
        icon={Lock}
        title={t("detail.missing.title")}
        body={t("detail.missing.body")}
        testID="session:unavailable"
      />
      <Button
        label={t("back")}
        variant="quiet"
        onPress={() => router.replace(routeHref("mobile.coach.sessions"))}
      />
    </Screen>
  );
}

function Detail({ session }: { session: CoachTrainingSession }) {
  const t = useTranslations("coachSessions");
  const format = useFormatter();
  const viewerZone = useTimeZone() ?? "UTC";
  const router = useRouter();
  const toast = useToast();
  const start = new Date(session.starts_at);
  const fighter = fighterLabel(session.fighter);
  const sameZone =
    viewerZone === session.time_zone ||
    zoneOffsetMinutes(viewerZone, start) === zoneOffsetMinutes(session.time_zone, start);

  const facts: [string, string][] = [
    [t("detail.facts.fighter"), fighter ?? t("planner.fighterNotShared")],
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
    [t("detail.facts.duration"), t("planner.minutes", { minutes: session.duration_minutes })],
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

  const cancelled = (outcome: CancelOutcome) => {
    // Only the backend's 200 is reported as cancelled; the page then shows
    // the session it returned (or reads it again).
    if (outcome.kind === "cancelled")
      toast.show({ title: t("cancelDialog.cancelled"), tone: "success" });
    else if (outcome.kind === "changed") toast.show({ title: t("cancelDialog.changed") });
    else toast.show({ title: t("cancelDialog.unavailable") });
  };

  return (
    <Screen>
      <View className="gap-2" testID={`session:${session.status}`}>
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

      <Notice tone="muted" icon={Info}>
        {t(`detail.aside.${session.status}`)}
      </Notice>

      {session.status === "planned" ? (
        <View className="gap-2">
          <Button
            label={t("detail.edit")}
            variant="quiet"
            onPress={() =>
              router.push(
                routeHref("mobile.coach.sessions._session-id.edit", { sessionId: session.id }),
              )
            }
            testID="session:edit"
          />
          <CancelSessionButton sessionId={session.id} fighterName={fighter} onDone={cancelled} />
        </View>
      ) : null}
    </Screen>
  );
}
