import { useRouter } from "expo-router";
import { CircleAlert, Lock } from "lucide-react-native";
import type { ReactNode } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";

import {
  isUnavailable,
  useCoachTrainingSession,
  type CoachTrainingSession,
} from "@/entities/training-session";
import {
  CreateTrainingSessionForm,
  EditTrainingSessionForm,
  type SaveOutcome,
} from "@/features/training-session-form";
import { routeHref } from "@/shared/routes/routes";
import { Button } from "@/shared/ui/button";
import { Notice } from "@/shared/ui/notice";
import { Screen } from "@/shared/ui/screen";
import { Spinner } from "@/shared/ui/spinner";
import { useToast } from "@/shared/ui/toast";

import { Message } from "./parts";
import { useScreenTitle } from "./use-screen-title";

/*
 * CT2 New session (`mobile.coach.sessions.new`) and CT4 Edit session
 * (`mobile.coach.sessions._session-id.edit`), SF-65; Claude Design
 * SessionControl.dc.html screen=create|edit, version 1792504884-2e4e. A
 * saved session opens its page (CT3) as the backend returned it.
 */

/**
 * A scrolling form screen under the native header. The scroll view insets
 * its content by exactly the part the keyboard covers (iOS), so any field
 * can be scrolled into view and nothing leaves a gap above the keyboard;
 * Android resizes the window itself.
 */
function FormScreen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-6 p-4"
      // Runtime safe-area inset below the last button.
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
    >
      {children}
    </ScrollView>
  );
}

export function CoachSessionCreateScreen() {
  const t = useTranslations("coachSessions");
  const router = useRouter();
  const toast = useToast();
  useScreenTitle("mobile/coach/sessions/new");

  const saved = (session: CoachTrainingSession, outcome: SaveOutcome) => {
    if (outcome === "created") toast.show({ title: t("form.saved.created"), tone: "success" });
    // The form stays on this screen's place in the stack: the session replaces it.
    router.replace(routeHref("mobile.coach.sessions._session-id", { sessionId: session.id }));
  };

  return (
    <FormScreen>
      <CreateTrainingSessionForm
        onSaved={saved}
        onFighters={() => router.navigate(routeHref("mobile.coach.fighters"))}
      />
    </FormScreen>
  );
}

export function CoachSessionEditScreen({ sessionId }: { sessionId: string }) {
  const t = useTranslations("coachSessions");
  const router = useRouter();
  const toast = useToast();
  const query = useCoachTrainingSession(sessionId);
  useScreenTitle("mobile/coach/sessions/_session-id/edit");

  if (query.isError && !isUnavailable(query.error)) {
    return (
      <Screen>
        <View accessibilityRole="alert" testID="session-edit:failed">
          <Notice tone="coral" icon={CircleAlert}>
            {`${t("detail.failed.title")} ${t("detail.failed.body")}`}
          </Notice>
        </View>
        <Button label={t("failed.retry")} variant="quiet" onPress={() => void query.refetch()} />
      </Screen>
    );
  }
  if (query.isError || query.data === null) {
    return (
      <Screen>
        <Message
          icon={Lock}
          title={t("detail.missing.title")}
          body={t("detail.missing.body")}
          testID="session-edit:unavailable"
        />
        <Button
          label={t("back")}
          variant="quiet"
          onPress={() => router.replace(routeHref("mobile.coach.sessions"))}
        />
      </Screen>
    );
  }
  if (query.data === undefined) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <Spinner label={t("form.loading")} />
        </View>
      </Screen>
    );
  }

  const session = query.data;
  const saved = (next: CoachTrainingSession, outcome: SaveOutcome) => {
    // Nothing changed: no request was sent, so nothing is reported as saved.
    if (outcome === "updated") toast.show({ title: t("form.saved.updated"), tone: "success" });
    if (router.canGoBack()) router.back();
    else router.replace(routeHref("mobile.coach.sessions._session-id", { sessionId: next.id }));
  };

  return (
    <FormScreen>
      <EditTrainingSessionForm
        // Not keyed by `updated_at`: a save stores the returned session before
        // its own callback runs, and a remount would drop that callback. A
        // session completed or cancelled meanwhile gets no form (its status),
        // and a refetch never wipes what the coach is typing.
        session={session}
        onSaved={saved}
      />
    </FormScreen>
  );
}
