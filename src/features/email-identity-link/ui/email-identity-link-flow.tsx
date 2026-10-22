import {
  Check,
  Clock,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import { useTranslations } from "use-intl";

import { Button } from "@/shared/ui/button";
import { CODE_LENGTH, CodeInput } from "@/shared/ui/code-input";
import { Icon } from "@/shared/ui/icon";
import { Input } from "@/shared/ui/input";
import { Notice, type NoticeTone } from "@/shared/ui/notice";
import { Text } from "@/shared/ui/text";
import { linkTo, TextLinks } from "@/shared/ui/text-link";

import { cellsFor, formatCountdown, type CodeStatus, type EmailStatus } from "../model/link";
import { useEmailIdentityLink } from "../model/use-email-identity-link";

/*
 * FCI3 Verify an email (SF-79 on SF-77; Claude Design FighterCoaches
 * `screen=verify`, version 1792675284-1046). Email → 6-digit code →
 * verified. The signed-in account stays the same; nothing else happens
 * here: no invitation is accepted, no account is created or merged.
 *
 * The flow renders a body and its bottom actions; the screen that hosts it
 * places them (keyboard and safe area) and decides what "done", "cancel",
 * "switch account" and "sign in" do.
 */

export type LinkLayout = (parts: { body: ReactNode; actions: ReactNode }) => ReactNode;

export type EmailIdentityLinkFlowProps = {
  layout: LinkLayout;
  /** "Back to invitations" after the email was verified. */
  onDone: () => void;
  /** Leave without verifying (also offered after a conflict). */
  onCancel: () => void;
  /** Sign out to use another account (offered after a conflict). */
  onSwitchAccount: () => void;
  /** Sign in again after the session ended. */
  onSignIn: () => void;
};

const EMAIL_NOTICES: Partial<Record<EmailStatus, NoticeTone>> = {
  limited: "amber",
  error: "coral",
};

const CODE_NOTICES: Partial<Record<CodeStatus, { tone: NoticeTone; icon: LucideIcon }>> = {
  sent: { tone: "olive", icon: Mail },
  resent: { tone: "olive", icon: RefreshCw },
  invalid: { tone: "coral", icon: TriangleAlert },
  expired: { tone: "amber", icon: Clock },
  throttled: { tone: "coral", icon: TriangleAlert },
  conflict: { tone: "coral", icon: Lock },
  session: { tone: "amber", icon: Lock },
  error: { tone: "coral", icon: TriangleAlert },
};

export function EmailIdentityLinkFlow(props: EmailIdentityLinkFlowProps) {
  const link = useEmailIdentityLink();
  const state = link.state;

  if (state.step === "email") return <EmailStep link={link} status={state.status} {...props} />;
  if (state.step === "code") return <CodeStep link={link} status={state.status} {...props} />;
  return (
    <Linked
      outcome={state.outcome}
      email={state.email}
      layout={props.layout}
      onDone={() => {
        link.reset();
        props.onDone();
      }}
    />
  );
}

type Link = ReturnType<typeof useEmailIdentityLink>;

function Heading({ title }: { title: string }) {
  const t = useTranslations("emailIdentityLink");
  return (
    <View className="gap-2">
      <Text variant="label" color="highlight">
        {t("eyebrow")}
      </Text>
      <Text variant="h1" accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

function EmailStep({
  link,
  status,
  layout,
}: { link: Link; status: EmailStatus } & EmailIdentityLinkFlowProps) {
  const t = useTranslations("emailIdentityLink");
  const sending = status === "sending";
  const notice = EMAIL_NOTICES[status];

  const body = (
    <View className="gap-4">
      <Heading title={t("email.title")} />
      <Text color="mutedForeground">{t("email.body")}</Text>
      <Input
        label={t("email.label")}
        value={link.email}
        onChangeText={link.changeEmail}
        placeholder={t("email.placeholder")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        inputMode="email"
        returnKeyType="send"
        editable={!sending}
        autoFocus
        onSubmitEditing={() => void link.request()}
        error={status === "invalid" ? t("email.invalid") : undefined}
      />
      {notice && (
        <Notice tone={notice} icon={TriangleAlert} live>
          {t(`email.${status as "limited" | "error"}`)}
        </Notice>
      )}
      <Text variant="caption" color="faintForeground">
        {t("email.note")}
      </Text>
    </View>
  );

  const actions = (
    <Button
      size="lg"
      label={sending ? t("email.sending") : t("email.send")}
      loading={sending}
      disabled={sending}
      onPress={() => void link.request()}
    />
  );

  return layout({ body, actions });
}

function CodeStep({
  link,
  status,
  layout,
  onCancel,
  onSwitchAccount,
  onSignIn,
}: { link: Link; status: CodeStatus } & EmailIdentityLinkFlowProps) {
  const t = useTranslations("emailIdentityLink");
  const notice = CODE_NOTICES[status];
  const submitting = status === "submitting";
  const terminal = status === "conflict" || status === "session";

  function press() {
    if (status === "expired") void link.resend();
    else if (status === "error") void link.retry();
    else void link.confirm(link.code);
  }

  const body = (
    <View className="gap-4">
      <Heading title={t("code.title")} />
      <Text color="mutedForeground">
        {t.rich("code.body", {
          email: link.sentTo,
          minutes: link.expiresInMinutes,
          b: (chunks) => (
            <Text weight="bold" color="foreground">
              {chunks}
            </Text>
          ),
        })}
      </Text>
      {!terminal && (
        <CodeInput
          label={t("code.label")}
          value={link.code}
          onChange={link.changeCode}
          onComplete={(value) => void link.confirm(value)}
          state={cellsFor(status, link.code)}
          autoFocus
        />
      )}
      {notice && (
        <Notice tone={notice.tone} icon={notice.icon} live>
          {t(`code.notices.${status}` as "code.notices.sent")}
        </Notice>
      )}
      {!terminal && <ResendRow link={link} status={status} />}
      {!terminal && (
        <TextLinks>
          {t.rich("code.wrongEmail", {
            link: linkTo(() => {
              if (!submitting) link.chooseDifferentEmail();
            }),
          })}
        </TextLinks>
      )}
      <Notice icon={Shield}>{t("code.neverShare")}</Notice>
    </View>
  );

  const actions =
    status === "conflict" ? (
      <View className="gap-2.5">
        {/* Distinct keys: a button never morphs into another one. */}
        <Button
          key="switch"
          size="lg"
          variant="quiet"
          label={t("code.switchAccount")}
          onPress={onSwitchAccount}
        />
        <Button key="back" size="lg" label={t("back")} onPress={onCancel} />
      </View>
    ) : status === "session" ? (
      <Button key="sign-in" size="lg" label={t("code.signIn")} onPress={onSignIn} />
    ) : (
      <Button
        key="submit"
        size="lg"
        label={
          status === "expired"
            ? t("code.sendNewCode")
            : status === "error"
              ? t("code.tryAgain")
              : submitting
                ? t("code.submitting")
                : t("code.submit")
        }
        loading={submitting}
        disabled={
          submitting ||
          status === "throttled" ||
          (!["expired", "error"].includes(status) && link.code.length !== CODE_LENGTH)
        }
        onPress={press}
      />
    );

  return layout({ body, actions });
}

/** "Didn't get it? … Resend in 0:42", or "Send a new code" once allowed. */
function ResendRow({ link, status }: { link: Link; status: CodeStatus }) {
  const t = useTranslations("emailIdentityLink.code");
  return (
    <View className="min-h-touch flex-row items-center justify-between gap-2.5">
      <Text variant="bodySm" color="mutedForeground">
        {t("didntGetIt")}
      </Text>
      {status === "throttled" ? (
        <Text variant="bodySm" color="faintForeground">
          {t("resendUnavailable")}
        </Text>
      ) : link.canResend ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void link.resend()}
          hitSlop={8}
          className="min-h-touch justify-center"
        >
          <Text variant="bodySm" weight="extrabold" color="highlight">
            {t("sendNewCode")}
          </Text>
        </Pressable>
      ) : (
        // Not a live region: it would announce every second.
        <Text variant="bodySm" color="faintForeground">
          {t("resendIn", { time: formatCountdown(link.secondsUntilResend) })}
        </Text>
      )}
    </View>
  );
}

function Linked({
  outcome,
  email,
  layout,
  onDone,
}: {
  outcome: "linked" | "already_linked";
  email: string;
  layout: LinkLayout;
  onDone: () => void;
}) {
  const t = useTranslations("emailIdentityLink.linked");
  const back = useTranslations("emailIdentityLink");
  const key = outcome === "linked" ? "new" : "already";
  const title = t(`${key}.title`);

  // Screen readers hear the confirmation as soon as it replaces the code step.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(title);
  }, [title]);

  const body = (
    <View className="gap-4" accessibilityLiveRegion="polite">
      <View className="size-16 items-center justify-center rounded-3xl bg-accent">
        <Icon icon={Check} size={30} color="highlight" />
      </View>
      <View className="gap-2">
        <Text variant="label" color="highlight">
          {t("eyebrow")}
        </Text>
        <Text variant="h1" accessibilityRole="header">
          {title}
        </Text>
      </View>
      <Text color="mutedForeground">
        {t.rich(`${key}.body`, {
          email,
          b: (chunks) => (
            <Text weight="bold" color="foreground">
              {chunks}
            </Text>
          ),
        })}
      </Text>
    </View>
  );

  return layout({ body, actions: <Button size="lg" label={back("back")} onPress={onDone} /> });
}
