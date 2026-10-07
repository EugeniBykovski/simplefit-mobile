import { Redirect, useRouter } from "expo-router";
import { Clock, Mail } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { useTranslations } from "use-intl";

import { withReturnTo } from "@/shared/routes/routes";
import { Button } from "@/shared/ui/button";
import { CODE_LENGTH, CodeInput } from "@/shared/ui/code-input";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { Text } from "@/shared/ui/text";
import { linkTo, TextLinks } from "@/shared/ui/text-link";

import {
  handOffToSignIn,
  registrationStatus,
  requestRegistrationCode,
  verifyRegistrationCode,
} from "../model/api";
import { EDITABLE, inputStateFor, requestFailureOf, type RequestFailure } from "../model/code-step";
import { pending, type PendingRegistration } from "../model/pending";
import { useCodeStep } from "../model/use-code-step";
import { ctaFor, ResendRow, StatusNotice } from "./code-step-parts";
import { OpenMailButton } from "./open-mail-button";
import type { CodeStepLayout } from "./sign-in-code-step";

/**
 * O03 "Verify your email" (email_verification): the code entered on this
 * device creates the account and the session. Without a pending registration
 * it goes back to the email step.
 */
export function RegistrationCodeStep({
  returnTo,
  layout,
}: {
  returnTo?: string;
  layout: CodeStepLayout;
}) {
  const flow = pending.get("registration");
  if (!flow) return <Redirect href={withReturnTo("mobile.signup", returnTo)} />;
  return <RegistrationCodeForm flow={flow} returnTo={returnTo} layout={layout} />;
}

export function RegistrationCodeForm({
  flow,
  returnTo,
  layout,
}: {
  flow: PendingRegistration;
  returnTo?: string;
  layout: CodeStepLayout;
}) {
  const t = useTranslations("auth.code.registration");
  const code = useTranslations("auth.code");
  const email = useTranslations("auth.email");
  const router = useRouter();
  // The latest registration token: a resend replaces it.
  const token = useRef(flow.registrationToken);
  const [handingOff, setHandingOff] = useState(false);
  const [handOffFailure, setHandOffFailure] = useState<RequestFailure | undefined>();

  const step = useCodeStep({
    purpose: "registration",
    initialStatus: "typing",
    resendAt: flow.resendAt,
    verify: (value) => verifyRegistrationCode(token.current, value),
    resend: async () => {
      const next = await requestRegistrationCode(flow.email);
      token.current = next.registrationToken;
      return next.resendAt;
    },
    onVerified: () => pending.clear("registration"),
  });
  const { status, report } = step;

  // Back from Mail: the link may have verified the address meanwhile.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !EDITABLE.has(status)) return;
      registrationStatus(token.current)
        .then((current) => {
          if (current === "verified_elsewhere" || current === "completed") {
            report("verified-elsewhere");
          } else if (current === "expired") {
            report("expired");
          }
        })
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, [status, report]);

  /** verified_elsewhere: a NEW email_sign_in challenge for the same address (D8). */
  async function handOff() {
    if (handingOff) return;
    setHandingOff(true);
    setHandOffFailure(undefined);
    try {
      await handOffToSignIn(flow.email);
      router.replace(withReturnTo("mobile.login.code", returnTo));
    } catch (error) {
      setHandOffFailure(requestFailureOf(error));
      // Only on failure: on success this screen is replaced by the sign-in code.
      setHandingOff(false);
    }
  }

  const cta = ctaFor(status, step.code.length === CODE_LENGTH);
  const final = status === "success" || status === "verified-elsewhere";

  function press() {
    if (cta.action === "submit") void step.submit(step.code);
    else if (cta.action === "resend") void step.resend();
    else if (cta.action === "retry") void step.retry();
    else if (cta.action === "handoff") void handOff();
  }

  const signIn = linkTo(() => router.replace(withReturnTo("mobile.login", returnTo)));

  const body = (
    <View className="gap-4">
      <View className="size-16 items-center justify-center rounded-3xl bg-accent">
        <Icon icon={Mail} size={30} color="highlight" />
      </View>
      <View className="gap-2">
        <Text variant="h1">{t("title")}</Text>
        <Text color="mutedForeground">
          {t.rich("description", {
            email: flow.email,
            b: (chunks) => (
              <Text weight="bold" color="foreground">
                {chunks}
              </Text>
            ),
          })}
        </Text>
      </View>
      <CodeInput
        label={code("label")}
        value={step.code}
        onChange={step.changeCode}
        onComplete={(value) => void step.submit(value)}
        state={inputStateFor(status, step.code)}
        autoFocus
      />
      <StatusNotice purpose="registration" status={status} email={flow.email} />
      {handOffFailure ? (
        <Text variant="caption" weight="bold" color="destructive" accessibilityRole="alert">
          {email(`errors.${handOffFailure}`)}
        </Text>
      ) : null}
      {status === "verified-elsewhere" && (
        <TextLinks>{t.rich("preferSignIn", { link: signIn })}</TextLinks>
      )}
      {!final && (
        <ResendRow
          status={status}
          secondsUntilResend={step.secondsUntilResend}
          canResend={step.canResend}
          onResend={() => void step.resend()}
        />
      )}
      {!final && <Notice icon={Clock}>{t("info")}</Notice>}
      {!final && (
        <View>
          <TextLinks>
            {t.rich("wrongAddress", {
              link: linkTo(() => router.replace(withReturnTo("mobile.signup", returnTo))),
            })}
          </TextLinks>
          <TextLinks>{t.rich("haveAccount", { link: signIn })}</TextLinks>
        </View>
      )}
    </View>
  );

  const actions = (
    <View className="gap-2.5">
      <OpenMailButton />
      <Button
        size="lg"
        label={
          cta.label === "submit" || cta.label === "submitting"
            ? t(`cta.${cta.label}`)
            : code(`cta.${cta.label}`)
        }
        disabled={cta.disabled || handingOff}
        loading={status === "submitting" || status === "success" || handingOff}
        onPress={press}
      />
    </View>
  );

  return layout({ body, actions });
}
