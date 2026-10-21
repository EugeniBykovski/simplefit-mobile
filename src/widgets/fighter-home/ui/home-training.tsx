import { useRouter } from "expo-router";
import { ChevronRight, CircleAlert } from "lucide-react-native";
import { Pressable, useWindowDimensions, View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";

import {
  isUnavailable,
  useCoachLine,
  useMyTrainingSessions,
  zoneCity,
  type MyTrainingSession,
} from "@/entities/training-session";
import { routeHref } from "@/shared/routes/routes";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { Skeleton } from "@/shared/ui/skeleton";
import { Text } from "@/shared/ui/text";

/** How many completed sessions the card previews (the list itself is on Training). */
const RECENT = 3;

/** From accessibility text sizes on, side-by-side columns leave the text too little width (as on Training, SF-66). */
const useStacked = () => useWindowDimensions().fontScale >= 1.3;

/**
 * The Home's Training card (SF-69; Claude Design 1792580627-132e,
 * `FirstRunFHome.dc.html` training=… recent=…), under the Live Board card:
 * the fighter's next assigned session and the latest completed ones, from
 * the same SF-63 projections (and the same cache) as the Training tab, so a
 * completion there refreshes it. The first upcoming session is the
 * backend's own (earliest first); nothing is counted, sorted or derived on
 * the device. Each projection loads and fails on its own: a failed read is
 * never an empty schedule, and it never takes the rest of Home with it.
 */
export function HomeTraining() {
  const t = useTranslations("fighterHome.training");
  const router = useRouter();
  const upcoming = useMyTrainingSessions("upcoming");
  const completed = useMyTrainingSessions("history", "completed");
  const unavailable = upcoming.isError && isUnavailable(upcoming.error);

  return (
    <View
      className="gap-3 rounded-3xl border border-border bg-surface px-4.5 py-4"
      testID="home:training"
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="label" color="highlight" accessibilityRole="header">
          {t("title")}
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("allLabel")}
          onPress={() => router.push(routeHref("mobile.training"))}
          className="min-h-touch justify-center"
          testID="home:training:all"
        >
          <Text variant="caption" weight="extrabold" color="highlight">
            {t("all")}
          </Text>
        </Pressable>
      </View>

      {unavailable ? (
        <View
          accessible
          accessibilityLabel={`${t("unavailable.title")}. ${t("unavailable.body")}`}
          className="gap-1 rounded-2xl bg-muted px-3.5 py-3"
          testID="home:training:unavailable"
        >
          <Text variant="bodySm" weight="extrabold">
            {t("unavailable.title")}
          </Text>
          <Text variant="caption" color="mutedForeground">
            {t("unavailable.body")}
          </Text>
        </View>
      ) : upcoming.isError && upcoming.data === undefined ? (
        <Failure
          message={t("failed.upcoming")}
          onRetry={() => void upcoming.refetch()}
          testID="home:training:failed"
        />
      ) : upcoming.data === undefined ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t("loading")}
          testID="home:training:loading"
        >
          <Skeleton className="h-24 rounded-2xl" />
        </View>
      ) : (
        <Next session={upcoming.data.pages[0]?.training_sessions[0]} />
      )}

      {unavailable || (completed.isError && isUnavailable(completed.error)) ? null : (
        <Recent
          sessions={completed.data?.pages[0]?.training_sessions.slice(0, RECENT)}
          failed={completed.isError}
          onRetry={() => void completed.refetch()}
        />
      )}
    </View>
  );
}

function Failure({
  message,
  onRetry,
  testID,
}: {
  message: string;
  onRetry: () => void;
  testID: string;
}) {
  const t = useTranslations("fighterHome.training");
  return (
    <View className="gap-2" testID={testID}>
      <View accessibilityRole="alert">
        <Notice tone="coral" icon={CircleAlert}>
          {message}
        </Notice>
      </View>
      <Button label={t("retry")} variant="quiet" size="sm" onPress={onRetry} />
    </View>
  );
}

function Next({ session }: { session: MyTrainingSession | undefined }) {
  const t = useTranslations("fighterHome.training");
  const training = useTranslations("fighterTraining");
  const format = useFormatter();
  const coach = useCoachLine();
  const router = useRouter();
  const stacked = useStacked();

  if (session === undefined) {
    return (
      <View
        accessible
        accessibilityLabel={`${t("empty.title")}. ${t("empty.body")}`}
        className="gap-1 rounded-2xl border-[1.5px] border-dashed border-input px-3.5 py-3"
        testID="home:training:empty"
      >
        <Text variant="bodySm" weight="extrabold">
          {t("empty.title")}
        </Text>
        <Text variant="caption" color="mutedForeground">
          {t("empty.body")}
        </Text>
      </View>
    );
  }

  const start = new Date(session.starts_at);
  const zone = session.time_zone;
  const time = format.dateTime(start, { hour: "2-digit", minute: "2-digit", timeZone: zone });
  const day = format.dateTime(start, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: zone,
  });
  const line = [
    training(`types.${session.training_type}`),
    coach(session).line,
    training("list.minutes", { minutes: session.duration_minutes }),
  ].join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[t("next"), session.title, `${day} ${time} ${zone}`, line].join(", ")}
      accessibilityHint={training("list.open")}
      onPress={() =>
        router.push(routeHref("mobile.sessions._session-id", { sessionId: session.id }))
      }
      className="gap-1.5 rounded-2xl border border-input bg-muted px-3.5 py-3 active:bg-surface"
      testID={`home:training:next:${session.id}`}
    >
      <Text variant="label" color="faintForeground">
        {t("next")}
      </Text>
      <View className={stacked ? "gap-1" : "flex-row items-center gap-3"}>
        <Text variant="h3" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {time}
        </Text>
        <View className={stacked ? "gap-0.5" : "flex-1 gap-0.5"}>
          <Text variant="bodySm" weight="extrabold" numberOfLines={stacked ? undefined : 2}>
            {session.title}
          </Text>
          <Text variant="caption" color="mutedForeground" numberOfLines={stacked ? undefined : 1}>
            {t("when", { date: day, zone: zoneCity(zone) })}
          </Text>
        </View>
      </View>
      <Text variant="caption" color="mutedForeground">
        {line}
      </Text>
    </Pressable>
  );
}

function Recent({
  sessions,
  failed,
  onRetry,
}: {
  sessions: MyTrainingSession[] | undefined;
  failed: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("fighterHome.training");
  const training = useTranslations("fighterTraining");
  const format = useFormatter();
  const coach = useCoachLine();
  const router = useRouter();
  const stacked = useStacked();

  return (
    <View>
      <Text variant="label" color="faintForeground" accessibilityRole="header" className="pb-1">
        {t("recent")}
      </Text>
      {failed && sessions === undefined ? (
        <Failure
          message={t("failed.recent")}
          onRetry={onRetry}
          testID="home:training:recent:failed"
        />
      ) : sessions === undefined ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t("loading")}
          testID="home:training:recent:loading"
        >
          <Skeleton className="h-12 rounded-xl" />
        </View>
      ) : sessions.length === 0 ? (
        <Text
          variant="caption"
          color="mutedForeground"
          className="border-t border-border py-3"
          testID="home:training:recent:empty"
        >
          {t("recentEmpty")}
        </Text>
      ) : (
        sessions.map((session) => {
          const sub = [
            format.dateTime(new Date(session.starts_at), {
              weekday: "short",
              day: "numeric",
              month: "short",
              timeZone: session.time_zone,
            }),
            training(`types.${session.training_type}`),
            coach(session).line,
          ].join(" · ");
          return (
            <Pressable
              key={session.id}
              accessibilityRole="button"
              accessibilityLabel={[session.title, sub, training("status.completed")].join(", ")}
              accessibilityHint={training("list.open")}
              onPress={() =>
                router.push(routeHref("mobile.sessions._session-id", { sessionId: session.id }))
              }
              className="min-h-touch flex-row items-center gap-2.5 border-t border-border py-2 active:bg-muted"
              testID={`home:training:recent:${session.id}`}
            >
              <View className="flex-1 gap-0.5">
                <Text variant="bodySm" weight="extrabold" numberOfLines={stacked ? undefined : 2}>
                  {session.title}
                </Text>
                <Text variant="caption" color="mutedForeground">
                  {sub}
                </Text>
                {stacked ? (
                  <View className="flex-row pt-1">
                    <Badge label={training("status.completed")} variant="success" />
                  </View>
                ) : null}
              </View>
              {stacked ? null : <Badge label={training("status.completed")} variant="success" />}
              <Icon icon={ChevronRight} size={16} color="faintForeground" />
            </Pressable>
          );
        })
      )}
    </View>
  );
}
