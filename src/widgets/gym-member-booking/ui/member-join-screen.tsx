import { useRouter } from "expo-router";
import { CircleAlert } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, KeyboardAvoidingView, Platform, View } from "react-native";
import { useTranslations } from "use-intl";

import { useMyGymMemberships, type GymMembership } from "@/entities/gym-booking";
import {
  formatJoinCode,
  JOIN_CODE_MAX_LENGTH,
  membershipProblem,
  useGymJoinPreview,
  useJoinGym,
  type MembershipProblem,
} from "@/features/gym-membership-manage";
import { withContinuation } from "@/shared/routes/continuation";
import { mobileGuards, routeHref } from "@/shared/routes/routes";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Notice } from "@/shared/ui/notice";
import { Screen } from "@/shared/ui/screen";
import { Text } from "@/shared/ui/text";

import { useMembershipProblemText } from "./membership-parts";
import { useScreenTitle } from "./parts";

/*
 * Join a gym with its code (`mobile.me.gyms.join`, SF-135). Adapted from A03
 * (Claude Design JoinInvite, 1793198527-a0fc): its code entry and gym card,
 * without its QR, six letters, role or group, which the domain does not have
 * (eight symbols, no role), and OF6's "Send join request"
 * (D-MOBILE-GYM-MEMBER-JOIN).
 *
 * The code is held only while this screen is open: it goes in request bodies,
 * never a route param, a store or a log, and the backend alone checks it. An
 * unknown, malformed, disabled or rotated code gets one answer. The preview
 * changes nothing; joining is a separate press. Whether it waits for the gym is
 * the backend's answer, never the preview's hint or this screen's.
 *
 * An unconfirmed join (the connection dropped) claims nothing: the memberships
 * are read again first, because the request may have landed. If they show this
 * gym the screen says so; otherwise trying again is safe, since joining again
 * returns the pending request.
 */
type Preview = { gym: { name: string }; requires_approval: boolean };
type Step =
  | { kind: "code" }
  | { kind: "preview"; preview: Preview }
  | { kind: "result"; membership: GymMembership; gym: string }
  | { kind: "already" }
  | { kind: "registration" };

export function MemberJoinScreen() {
  const t = useTranslations("gymMembership.join");
  useScreenTitle("mobile/me/gyms/join");
  const [step, setStep] = useState<Step>({ kind: "code" });
  // Survives a recoverable failure and going back from the preview.
  const [code, setCode] = useState("");

  const finished = (next: Step) => {
    setCode("");
    setStep(next);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <Screen>
        <View className="gap-1">
          <Text variant="label" color="faintForeground">
            {t("eyebrow")}
          </Text>
          <Text variant="h1" accessibilityRole="header">
            {t("title")}
          </Text>
        </View>
        {step.kind === "code" ? (
          <CodeStep
            code={code}
            onCode={setCode}
            onPreview={(preview) => setStep({ kind: "preview", preview })}
            onRegistration={() => finished({ kind: "registration" })}
          />
        ) : null}
        {step.kind === "preview" ? (
          <PreviewStep
            code={code}
            preview={step.preview}
            onBack={() => setStep({ kind: "code" })}
            onResult={(membership) =>
              finished({ kind: "result", membership, gym: step.preview.gym.name })
            }
            onAlready={() => finished({ kind: "already" })}
            onRegistration={() => finished({ kind: "registration" })}
          />
        ) : null}
        {step.kind === "result" ? <Result membership={step.membership} gym={step.gym} /> : null}
        {step.kind === "already" ? (
          <Outcome
            title={t("already.title")}
            body={t("already.body")}
            action={t("already.action")}
          />
        ) : null}
        {step.kind === "registration" ? <Registration /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Outcome({
  title,
  body,
  action,
  href,
}: {
  title: string;
  body: string;
  action: string;
  href?: Parameters<ReturnType<typeof useRouter>["replace"]>[0];
}) {
  const router = useRouter();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${title}. ${body}`);
  }, [title, body]);
  return (
    <View className="gap-3" testID="member-join-result">
      <Text variant="h3" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="body" color="mutedForeground">
        {body}
      </Text>
      <Button label={action} onPress={() => router.replace(href ?? routeHref("mobile.me.gyms"))} />
    </View>
  );
}

function Result({ membership, gym }: { membership: GymMembership; gym: string }) {
  const t = useTranslations("gymMembership.join");
  return membership.status === "active" ? (
    <Outcome
      title={t("active.title", { gym })}
      body={t("active.body")}
      action={t("active.action")}
      href={routeHref("mobile.me.gyms._gym-id.classes", { gymId: membership.gym.gym_id })}
    />
  ) : (
    <Outcome
      title={t("requested.title", { gym })}
      body={t("requested.body")}
      action={t("requested.action")}
    />
  );
}

function Registration() {
  const t = useTranslations("gymMembership.join.registration");
  return (
    <Outcome
      title={t("title")}
      body={t("body")}
      action={t("action")}
      href={withContinuation(mobileGuards.entry, {
        returnTo: routeHref("mobile.me.gyms.join") as string,
      })}
    />
  );
}

function CodeStep({
  code,
  onCode,
  onPreview,
  onRegistration,
}: {
  code: string;
  onCode: (code: string) => void;
  onPreview: (preview: Preview) => void;
  onRegistration: () => void;
}) {
  const t = useTranslations("gymMembership.join");
  const text = useMembershipProblemText();
  const lookup = useGymJoinPreview();
  const [missing, setMissing] = useState(false);

  const problem: MembershipProblem | null = lookup.isError ? membershipProblem(lookup.error) : null;
  const fieldError = missing
    ? t("required")
    : problem?.kind === "notFound"
      ? t("notFound")
      : undefined;

  const submit = () => {
    if (lookup.isPending) return;
    const value = code.trim();
    if (value === "") {
      lookup.reset();
      setMissing(true);
      return;
    }
    setMissing(false);
    lookup.mutate(value, {
      onSuccess: (answer) => onPreview(answer.preview),
      onError: (error) => {
        if (membershipProblem(error).kind === "registration") onRegistration();
      },
    });
  };

  return (
    <View className="gap-4">
      <Text variant="body" color="mutedForeground">
        {t("lead")}
      </Text>
      <Input
        label={t("label")}
        description={t("hint")}
        error={fieldError}
        value={code}
        placeholder="ABCD-EFGH"
        maxLength={JOIN_CODE_MAX_LENGTH}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        textContentType="none"
        importantForAutofill="no"
        returnKeyType="go"
        onSubmitEditing={submit}
        onChangeText={(value) => {
          onCode(formatJoinCode(value));
          setMissing(false);
          if (lookup.isError) lookup.reset();
        }}
        testID="member-join-code"
      />
      {problem !== null && problem.kind !== "notFound" ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Notice tone={problem.kind === "limited" ? "amber" : "coral"} icon={CircleAlert}>
            {text(problem)}
          </Notice>
        </View>
      ) : null}
      <Button
        label={lookup.isPending ? t("finding") : t("find")}
        loading={lookup.isPending}
        onPress={submit}
        testID="member-join-find"
      />
    </View>
  );
}

function PreviewStep({
  code,
  preview,
  onBack,
  onResult,
  onAlready,
  onRegistration,
}: {
  code: string;
  preview: Preview;
  onBack: () => void;
  onResult: (membership: GymMembership) => void;
  onAlready: () => void;
  onRegistration: () => void;
}) {
  const t = useTranslations("gymMembership.join");
  const text = useMembershipProblemText();
  const join = useJoinGym();
  const list = useMyGymMemberships({ enabled: false });
  const [checking, setChecking] = useState(false);
  const gymName = preview.gym.name;
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    AccessibilityInfo.announceForAccessibility(`${t("preview.heading")} ${gymName}`);
  }, [gymName, t]);

  const problem = join.isError ? membershipProblem(join.error) : null;
  const busy = join.isPending || checking;

  /** The outcome is unknown: the backend's list decides before anything is sent again. */
  const reconcile = async () => {
    setChecking(true);
    const answer = await list.query.refetch();
    setChecking(false);
    const rows = answer.data?.pages.flatMap((page) => page.memberships) ?? [];
    const landed = rows.find(
      (row) => row.gym.name === gymName && (row.status === "requested" || row.status === "active"),
    );
    if (landed !== undefined) onResult(landed);
  };

  return (
    <View className="gap-4">
      <View className="gap-2 rounded-3xl border border-border bg-surface px-5 py-4">
        <Text variant="label" color="faintForeground">
          {t("preview.heading")}
        </Text>
        <Text variant="h3" accessibilityRole="header" testID="member-join-gym">
          {gymName}
        </Text>
        <Text variant="bodySm" color="mutedForeground">
          {t(preview.requires_approval ? "preview.approval" : "preview.instant")}
        </Text>
      </View>
      {problem !== null ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Notice tone={problem.kind === "limited" ? "amber" : "coral"} icon={CircleAlert}>
            {problem.kind === "notFound" ? t("notFound") : text(problem)}
          </Notice>
        </View>
      ) : null}
      <Button
        label={
          join.isPending
            ? t("preview.submitting")
            : t(preview.requires_approval ? "preview.submitApproval" : "preview.submitInstant")
        }
        loading={busy}
        testID="member-join-submit"
        onPress={() =>
          join.mutate(code.trim(), {
            onSuccess: (answer) => onResult(answer.membership),
            onError: (error) => {
              const kind = membershipProblem(error).kind;
              if (kind === "alreadyMember") onAlready();
              else if (kind === "registration") onRegistration();
              else if (kind === "unknown") void reconcile();
            },
          })
        }
      />
      <Button variant="outline" label={t("preview.other")} disabled={busy} onPress={onBack} />
      <Text variant="caption" color="faintForeground">
        {t("privacy")}
      </Text>
    </View>
  );
}
