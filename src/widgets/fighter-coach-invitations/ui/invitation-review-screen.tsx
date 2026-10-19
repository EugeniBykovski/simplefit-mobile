import { useNavigation, useRouter } from "expo-router";
import { Check, CircleAlert, ShieldCheck } from "lucide-react-native";
import { useLayoutEffect, useState } from "react";
import { View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";

import { useInvitationPreview, type InvitationPreview } from "@/entities/incoming-coach-invitation";
import {
  respondProblem,
  useAcceptInvitation,
  useDeclineInvitation,
  type RespondProblem,
} from "@/features/coach-invitation-respond";
import type { LegalDocumentRef } from "@/shared/api/generated/model";
import { isLocale, localeName } from "@/shared/i18n/locales";
import { fillLegalPlaceholders } from "@/shared/lib/legal-text";
import { routeHref } from "@/shared/routes/routes";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Icon } from "@/shared/ui/icon";
import { LegalText } from "@/shared/ui/legal-text";
import { Notice } from "@/shared/ui/notice";
import { Screen } from "@/shared/ui/screen";
import { Sheet } from "@/shared/ui/sheet";
import { Skeleton } from "@/shared/ui/skeleton";
import { Text } from "@/shared/ui/text";

import { inviterName } from "./invitations-screen";

/*
 * FCI2 Invitation review (`mobile.profile.coaches.invitations._invitation-id`,
 * SF-76; Claude Design FighterCoaches screen=invite, version 1792432236-08da).
 *
 * One incoming invitation, read on every entry from
 * `previewMyIncomingCoachInvitation` in the app language (the route
 * parameter authorizes nothing). It shows the coach's public identity, the
 * note, the expiry, what the coach would see and what is never shared, and
 * the backend's current disclosure: title, version, the language of the
 * approved text, its summary and its full text on demand. The fighter
 * accepts only by ticking the approved confirmation next to an unticked box;
 * the request carries exactly that version and language. The app writes no
 * legal text and never shows another language instead: without an approved
 * text in the app language (or with no published disclosure) the fighter
 * can only decline. Declining is confirmed first and allowed even while
 * sharing is off. Every outcome is the backend's answer.
 */

type Outcome = "accepted" | "already" | "declined" | "unavailable" | "sharing";

export function InvitationReviewScreen({ invitationId }: { invitationId: string | undefined }) {
  const t = useTranslations("fighterInvitations");
  const titles = useTranslations("routes.titles");
  const navigation = useNavigation();
  const preview = useInvitationPreview(invitationId);
  const [outcome, setOutcome] = useState<{ kind: Outcome; name: string } | null>(null);
  const title = titles("mobile/profile/coaches/invitations/_invitation-id");

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const fallback = t("fallbackName");
  if (outcome) return <OutcomeState kind={outcome.kind} name={outcome.name} />;
  if (preview.isPending) {
    return (
      <Screen>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t("review.loading")}
          className="gap-3"
          testID="invitation:loading"
        >
          <Skeleton className="h-19 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-44 rounded-3xl" />
        </View>
      </Screen>
    );
  }
  if (preview.isError) {
    const problem = respondProblem(preview.error);
    if (problem === "sharing" && invitationId !== undefined) {
      // Sharing is off: nothing can be accepted, but declining grants
      // nothing and stays available (SF-73).
      return (
        <OutcomeState
          kind="sharing"
          name={fallback}
          decline={{ invitationId, onOutcome: setOutcome }}
        />
      );
    }
    if (problem === "sharing" || problem === "unavailable") {
      return <OutcomeState kind="unavailable" name={fallback} />;
    }
    return <OutcomeState kind="failed" name={fallback} retry={() => void preview.refetch()} />;
  }
  if (preview.data === null || invitationId === undefined) {
    return <OutcomeState kind="unavailable" name={fallback} />;
  }
  return (
    <Review
      invitationId={invitationId}
      preview={preview.data}
      refetch={() => void preview.refetch()}
      onOutcome={setOutcome}
    />
  );
}

function Review({
  invitationId,
  preview,
  refetch,
  onOutcome,
}: {
  invitationId: string;
  preview: InvitationPreview;
  refetch: () => void;
  onOutcome: (outcome: { kind: Outcome; name: string }) => void;
}) {
  const t = useTranslations("fighterInvitations");
  const format = useFormatter();
  const router = useRouter();
  const [problem, setProblem] = useState<RespondProblem | null>(null);
  const [full, setFull] = useState(false);
  const [declining, setDeclining] = useState(false);
  const accept = useAcceptInvitation(invitationId);
  const decline = useDeclineInvitation(invitationId);
  const busy = accept.isPending || decline.isPending;

  const { invitation, disclosure, document } = preview;
  const name = inviterName(invitation.coach, t("fallbackName"));
  const brand = invitation.coach.display_name ? invitation.coach.brand_name : null;
  const presented = document?.language ?? null;
  const checkbox = document?.checkbox ?? null;
  // Never another language: without an approved text in this one (or no
  // published disclosure) the fighter can read the metadata and decline.
  const readable = document !== null && presented !== null && checkbox !== null;
  const blocked = !readable || problem === "tooYoung" || problem === "profile";

  const answered = (kind: Outcome) => onOutcome({ kind, name });

  const onAccept = (version: string, language: NonNullable<LegalDocumentRef["language"]>) => {
    setProblem(null);
    accept.mutate(
      { version, language },
      {
        onSuccess: (result) => answered(result === "created" ? "accepted" : "already"),
        onError: (error) => {
          const next = respondProblem(error);
          if (next === "sharing" || next === "unavailable") return answered(next);
          setProblem(next);
          // A newer version or a withdrawn language: show what the backend
          // serves now; the confirmation starts unticked again.
          if (next === "stale" || next === "language") refetch();
        },
      },
    );
  };

  return (
    <Screen>
      <View className="gap-3.5" testID="invitation:review">
        <Text variant="h2" accessibilityRole="header">
          {t("review.title", { name })}
        </Text>

        <View className="gap-3 rounded-3xl border border-border bg-surface p-4">
          <View className="flex-row items-center gap-3">
            <Avatar name={name} />
            <View className="flex-1 gap-0.5">
              <Text variant="body" weight="extrabold">
                {name}
              </Text>
              {brand ? (
                <Text variant="caption" color="mutedForeground">
                  {brand}
                </Text>
              ) : null}
            </View>
            <Text variant="label" color="faintForeground">
              {t("review.expires", {
                date: format.dateTime(new Date(invitation.expires_at), "date"),
              })}
            </Text>
          </View>
          {invitation.message ? (
            <Text className="border-t border-border pt-3">
              {t("review.note", { note: invitation.message, name })}
            </Text>
          ) : null}
        </View>

        <View className="rounded-3xl border border-border bg-surface px-4 pb-1 pt-3.5">
          <Text
            variant="label"
            color="faintForeground"
            accessibilityRole="header"
            className="pb-1.5"
          >
            {t("review.sees", { name })}
          </Text>
          {disclosure.fields.map((field) => (
            <View
              key={field}
              className="min-h-11 flex-row items-center gap-2.5 border-t border-border py-2"
            >
              <Icon icon={Check} size={16} color="highlight" />
              <Text variant="body" weight="bold">
                {t(`review.fields.${field}`)}
              </Text>
            </View>
          ))}
        </View>

        <View className="gap-2 rounded-3xl border border-border bg-surface p-4">
          <View className="flex-row items-center gap-2">
            <Icon icon={ShieldCheck} size={16} color="faintForeground" />
            <Text variant="label" color="faintForeground" accessibilityRole="header">
              {t("review.neverTitle")}
            </Text>
          </View>
          <Text variant="bodySm" color="mutedForeground">
            {disclosure.never_shared.map((item) => t(`review.never.${item}`)).join(" · ")}
          </Text>
        </View>

        {document !== null && readable ? (
          <View
            className="gap-2 rounded-3xl border border-border bg-surface p-4"
            testID="invitation:document"
          >
            {/* Caption, not the uppercase label role: the version id is shown exactly. */}
            <Text variant="caption" color="faintForeground">
              {t("review.document", {
                version: document.version,
                language: isLocale(presented) ? localeName(presented) : presented,
              })}
            </Text>
            {document.title ? (
              <Text variant="h3" accessibilityRole="header">
                {document.title}
              </Text>
            ) : null}
            {document.summary ? (
              <LegalText
                text={fillLegalPlaceholders(document.summary, {
                  coach: name,
                  version: document.version,
                })}
                testID="invitation:summary"
              />
            ) : null}
            {document.full !== null ? (
              <Button label={t("review.readFull")} variant="quiet" onPress={() => setFull(true)} />
            ) : null}
          </View>
        ) : null}

        <ProblemNotice
          problem={readable ? problem : document === null ? "document" : "language"}
          languages={(document?.available_languages ?? [])
            .map((code) => (isLocale(code) ? localeName(code) : code))
            .join(", ")}
        />

        {!blocked && document !== null && presented !== null && checkbox !== null ? (
          <Consent
            // A different version or language is a different text: agree again.
            key={`${document.version}|${presented}`}
            label={fillLegalPlaceholders(checkbox, { coach: name, version: document.version })}
            busy={busy}
            accepting={accept.isPending}
            onAccept={() => onAccept(disclosure.version, presented)}
          />
        ) : null}

        {problem === "profile" ? (
          <Button
            label={t("review.continueSetup")}
            onPress={() => router.replace(routeHref("mobile.root"))}
          />
        ) : null}

        <Button
          label={decline.isPending ? t("review.declining") : t("review.decline")}
          variant="quiet"
          disabled={busy}
          onPress={() => setDeclining(true)}
        />
        {!blocked ? (
          <Text variant="caption" color="faintForeground">
            {t("review.acceptHint")}
          </Text>
        ) : null}
      </View>

      {document !== null && document.full !== null ? (
        <Sheet
          visible={full}
          onClose={() => setFull(false)}
          title={document.title ?? t("review.readFull")}
          description={t("review.document", {
            version: document.version,
            language: presented && isLocale(presented) ? localeName(presented) : (presented ?? ""),
          })}
          closeLabel={t("review.closeFull")}
        >
          <LegalText
            text={fillLegalPlaceholders(document.full, { coach: name, version: document.version })}
            testID="invitation:full"
          />
          <Button label={t("review.closeFull")} variant="quiet" onPress={() => setFull(false)} />
        </Sheet>
      ) : null}

      <DeclineSheet
        visible={declining}
        name={name}
        decline={decline}
        onClose={() => setDeclining(false)}
        onDone={answered}
      />
    </Screen>
  );
}

function Consent({
  label,
  busy,
  accepting,
  onAccept,
}: {
  label: string;
  busy: boolean;
  accepting: boolean;
  onAccept: () => void;
}) {
  const t = useTranslations("fighterInvitations.review");
  const [agreed, setAgreed] = useState(false);
  return (
    <View className="gap-3" testID="invitation:consent">
      <Checkbox label={label} checked={agreed} disabled={busy} onChange={setAgreed} />
      <Button
        label={accepting ? t("accepting") : t("accept")}
        loading={accepting}
        disabled={!agreed || busy}
        onPress={onAccept}
      />
    </View>
  );
}

function ProblemNotice({
  problem,
  languages,
}: {
  problem: RespondProblem | "document" | null;
  languages: string;
}) {
  const t = useTranslations("fighterInvitations.review.problems");
  if (problem === null || problem === "sharing" || problem === "unavailable") return null;
  const coral = problem === "tooYoung" || problem === "failed";
  return (
    <View accessibilityRole="alert" testID={`invitation:problem:${problem}`}>
      <Notice tone={coral ? "coral" : "amber"} icon={CircleAlert}>
        {`${t(`${problem}.title`)} ${t(`${problem}.body`, { languages })}`}
      </Notice>
    </View>
  );
}

function OutcomeState({
  kind,
  name,
  retry,
  decline,
}: {
  kind: Outcome | "failed";
  name: string;
  retry?: () => void;
  decline?: { invitationId: string; onOutcome: (outcome: { kind: Outcome; name: string }) => void };
}) {
  const t = useTranslations("fighterInvitations.review");
  const router = useRouter();
  const toCoaches = kind === "accepted" || kind === "already";

  return (
    <Screen>
      <View
        accessible
        accessibilityRole={kind === "failed" ? "alert" : "summary"}
        className="gap-2.5 rounded-3xl border border-border bg-surface p-5"
        testID={`invitation:outcome:${kind}`}
      >
        <Text variant="h3" accessibilityRole="header">
          {t(`outcome.${kind}.title`, { name })}
        </Text>
        <Text color="mutedForeground">{t(`outcome.${kind}.body`, { name })}</Text>
      </View>
      {retry ? <Button label={t("retry")} onPress={retry} /> : null}
      <Button
        label={t(`outcome.${kind}.action`)}
        variant={toCoaches ? "primary" : "quiet"}
        onPress={() =>
          router.dismissTo(
            routeHref(toCoaches ? "mobile.profile.coaches" : "mobile.profile.coaches.invitations"),
          )
        }
      />
      {decline ? <DeclineWhileOff {...decline} name={name} /> : null}
    </Screen>
  );
}

/** Declining while sharing is off: the same confirmation as on the review. */
function DeclineWhileOff({
  invitationId,
  name,
  onOutcome,
}: {
  invitationId: string;
  name: string;
  onOutcome: (outcome: { kind: Outcome; name: string }) => void;
}) {
  const t = useTranslations("fighterInvitations.review");
  const [open, setOpen] = useState(false);
  const decline = useDeclineInvitation(invitationId);
  return (
    <>
      <Button label={t("decline")} variant="quiet" onPress={() => setOpen(true)} />
      <DeclineSheet
        visible={open}
        name={name}
        decline={decline}
        onClose={() => setOpen(false)}
        onDone={(kind) => onOutcome({ kind, name })}
      />
    </>
  );
}

/**
 * The decline confirmation. The request runs once (confirm disabled, the
 * sheet not dismissible while it runs); a failure keeps the sheet open and
 * changes nothing; only the backend's answer is reported.
 */
function DeclineSheet({
  visible,
  name,
  decline,
  onClose,
  onDone,
}: {
  visible: boolean;
  name: string;
  decline: ReturnType<typeof useDeclineInvitation>;
  onClose: () => void;
  onDone: (outcome: "declined" | "unavailable") => void;
}) {
  const t = useTranslations("fighterInvitations.review.declineSheet");
  const close = () => {
    if (decline.isPending) return;
    decline.reset();
    onClose();
  };
  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={t("title", { name })}
      description={t("body", { name })}
      closeLabel={t("keep")}
      dismissible={!decline.isPending}
      role="alert"
    >
      {decline.isError ? (
        <View accessibilityRole="alert">
          <Notice tone="coral" icon={CircleAlert}>
            {t("failed")}
          </Notice>
        </View>
      ) : null}
      <Button
        label={decline.isPending ? t("pending") : t("confirm")}
        variant="destructive"
        loading={decline.isPending}
        disabled={decline.isPending}
        onPress={() =>
          decline.mutate(undefined, {
            onSuccess: (result) => {
              onClose();
              onDone(result);
            },
          })
        }
      />
      <Button label={t("keep")} variant="quiet" disabled={decline.isPending} onPress={close} />
    </Sheet>
  );
}
