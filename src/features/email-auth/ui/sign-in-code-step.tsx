import { Redirect, useRouter } from "expo-router";
import { Lock, Shield } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { withReturnTo } from "@/shared/routes/routes";
import { Button } from "@/shared/ui/button";
import { CODE_LENGTH, CodeInput } from "@/shared/ui/code-input";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { Text } from "@/shared/ui/text";
import { linkTo, TextLinks } from "@/shared/ui/text-link";

import { requestSignInCode, verifySignInCode } from "../model/api";
import { inputStateFor } from "../model/code-step";
import { pending, type PendingSignIn } from "../model/pending";
import { useCodeStep } from "../model/use-code-step";
import { ctaFor, ResendRow, StatusNotice } from "./code-step-parts";
import { OpenMailButton } from "./open-mail-button";

export type CodeStepLayout = (parts: { body: ReactNode; actions: ReactNode }) => ReactNode;

/**
 * O01c "Enter your sign-in code" (email_sign_in). Without a pending sign-in
 * (opened directly, or after a restart) it goes back to the email step.
 * `layout` places the body and the bottom actions in the screen frame.
 */
export function SignInCodeStep({
  returnTo,
  layout,
}: {
  returnTo?: string;
  layout: CodeStepLayout;
}) {
  const flow = pending.get("signIn");
  if (!flow) return <Redirect href={withReturnTo("mobile.login", returnTo)} />;
  return <SignInCodeForm flow={flow} returnTo={returnTo} layout={layout} />;
}

export function SignInCodeForm({
  flow,
  returnTo,
  layout,
}: {
  flow: PendingSignIn;
  returnTo?: string;
  layout: CodeStepLayout;
}) {
  const t = useTranslations("auth.code.signIn");
  const code = useTranslations("auth.code");
  const router = useRouter();
  const step = useCodeStep({
    purpose: "sign-in",
    initialStatus: "sent",
    resendAt: flow.resendAt,
    verify: (value) => verifySignInCode(flow.email, value),
    resend: () => requestSignInCode(flow.email),
    onVerified: () => pending.clear("signIn"),
  });
  const cta = ctaFor(step.status, step.code.length === CODE_LENGTH);
  const final = step.status === "success";

  function press() {
    if (cta.action === "submit") void step.submit(step.code);
    else if (cta.action === "resend") void step.resend();
    else if (cta.action === "retry") void step.retry();
  }

  const body = (
    <View className="gap-4">
      <View className="size-16 items-center justify-center rounded-3xl bg-accent">
        <Icon icon={Lock} size={30} color="highlight" />
      </View>
      <View className="gap-2">
        <Text variant="label" color="highlight">
          {t("eyebrow")}
        </Text>
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
        state={inputStateFor(step.status, step.code)}
        autoFocus
      />
      <StatusNotice purpose="sign-in" status={step.status} email={flow.email} />
      {!final && (
        <ResendRow
          status={step.status}
          secondsUntilResend={step.secondsUntilResend}
          canResend={step.canResend}
          onResend={() => void step.resend()}
        />
      )}
      {!final && (
        <TextLinks>
          {t.rich("wrongEmail", {
            link: linkTo(() => router.replace(withReturnTo("mobile.login", returnTo))),
          })}
        </TextLinks>
      )}
      <Notice icon={Shield}>{code("neverShare")}</Notice>
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
        disabled={cta.disabled}
        loading={step.status === "submitting" || final}
        onPress={press}
      />
    </View>
  );

  return layout({ body, actions });
}
