import { useRouter } from "expo-router";
import { Mail } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { withContinuation, type Continuation } from "@/shared/routes/continuation";
import type { MobileRouteId } from "@/shared/routes/routes";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { requestRegistrationCode, requestSignInCode } from "../model/api";
import { requestFailureOf, type RequestFailure } from "../model/code-step";
import { normalizeEmail } from "../model/pending";

type Props = {
  /** Requests the code and records the pending flow; the API answers alike for every address. */
  request: (email: string) => Promise<unknown>;
  /** The code screen (`/login/code`, `/signup/verify`). */
  next: MobileRouteId;
  continuation?: Continuation;
  submitLabel: string;
  hint: string;
  /** Content between the field and the button (O02 "No password" note). */
  children?: ReactNode;
  /** Fields shown before the email field (O02's presentational Full name). */
  leadingFields?: ReactNode;
  /**
   * Places the fields and the submit button in the screen (O02 pins the
   * button in its bottom action stack). Default: one column.
   */
  layout?: (parts: { fields: ReactNode; submit: ReactNode }) => ReactNode;
};

// A shape check for UX only; the API validates and normalizes the address.
const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+$/.test(value);

/**
 * The email step shared by sign-in (O01b, email_sign_in) and sign-up (O02,
 * email_verification). After any accepted request the user continues to the
 * code screen: whether an account exists is never revealed (the API sends
 * decoy responses).
 */
export function EmailRequestForm({
  request,
  next,
  continuation,
  submitLabel,
  hint,
  children,
  leadingFields,
  layout,
}: Props) {
  const t = useTranslations("auth.email");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<RequestFailure | undefined>();

  async function submit() {
    if (busy) return;
    const address = normalizeEmail(email);
    if (!looksLikeEmail(address)) {
      setFailure("invalidEmail");
      return;
    }
    setBusy(true);
    setFailure(undefined);
    try {
      await request(address);
      router.push(withContinuation(next, continuation));
    } catch (error) {
      setFailure(requestFailureOf(error));
    } finally {
      setBusy(false);
    }
  }

  const fields = (
    <View className="gap-4">
      {leadingFields}
      <Input
        label={t("label")}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setFailure(undefined);
        }}
        description={hint}
        error={failure ? t(`errors.${failure}`) : undefined}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="send"
        onSubmitEditing={() => void submit()}
      />
      {children}
    </View>
  );
  const submitButton = (
    <Button
      label={submitLabel}
      icon={Mail}
      size="lg"
      loading={busy}
      onPress={() => void submit()}
    />
  );

  if (layout) return layout({ fields, submit: submitButton });
  return (
    <View className="gap-4">
      {fields}
      {submitButton}
    </View>
  );
}

type StepFormProps = Omit<Props, "request" | "next">;

/** O01b "Email me a sign-in code" (B, email_sign_in) → `/login/code`. */
export function SignInEmailForm(props: StepFormProps) {
  return <EmailRequestForm {...props} request={requestSignInCode} next="mobile.login.code" />;
}

/** O02 "Continue with email" (A, email_verification) → `/signup/verify`. */
export function RegistrationEmailForm(props: StepFormProps) {
  return (
    <EmailRequestForm {...props} request={requestRegistrationCode} next="mobile.signup.verify" />
  );
}
