import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { ChevronLeft, Mail } from "lucide-react-native";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { useTranslations } from "use-intl";

import {
  RegistrationCodeStep,
  RegistrationEmailForm,
  SignInCodeStep,
  SignInEmailForm,
  type CodeStepLayout,
} from "@/features/email-auth";
import { AppleSignInButton } from "@/features/sign-in-with-apple";
import { GoogleSignInButton } from "@/features/sign-in-with-google";
import { mobileGuards, sanitizeReturnTo, withReturnTo } from "@/shared/routes/routes";
import { useTheme } from "@/shared/styles/theme";
import { BrandLockup } from "@/shared/ui/brand-mark";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { Text } from "@/shared/ui/text";
import { linkTo, TextLinks } from "@/shared/ui/text-link";

/*
 * The mobile.auth screens (Claude Design onboarding page, 390 × 844): A01
 * Welcome, O01b Sign in, O01c Sign-in code, O02 Create account, O03 Verify
 * email. Every sign-in method ends in the shared session pipeline; the
 * auth shell's SessionGate then enters the application (a valid `returnTo`,
 * otherwise `/`). Deferred until their domain exists (SF-25 and the
 * recovery/invite tickets): O02 full name, O01b "Recover account", A01
 * invite and brands links, and the consent / role / workspace destinations.
 */

/** The valid `returnTo` of the current auth screen (SF-24 policy), carried between steps. */
function useReturnTo(): string | undefined {
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const value = params[mobileGuards.returnToParam];
  return sanitizeReturnTo(Array.isArray(value) ? undefined : value);
}

/**
 * Frame of the designed auth screens: a 44 pt back button and the content on
 * 20 pt gutters, the main actions pinned above the home indicator. Insets are
 * runtime values (the only `style`).
 */
function AuthFrame({
  back,
  children,
  actions,
  gutter = "px-5",
}: {
  back?: Href;
  children: ReactNode;
  actions?: ReactNode;
  gutter?: "px-5" | "px-6";
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTranslations("auth.login");

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName={`grow gap-4 pb-6 ${gutter}`}
        // Runtime inset: the artboards' 58 pt top is the status bar plus 11 pt.
        style={{ paddingTop: insets.top + 11 }}
      >
        {back !== undefined && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("back")}
            onPress={() => (router.canGoBack() ? router.back() : router.replace(back))}
            className="size-11 items-center justify-center rounded-full border border-border bg-surface"
          >
            <Icon icon={ChevronLeft} />
          </Pressable>
        )}
        {children}
      </ScrollView>
      {actions !== undefined && (
        <View
          className={`gap-2.5 pt-3 ${gutter}`}
          // Runtime inset: the artboards keep the actions 34 pt above the bottom edge.
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          {actions}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function Heading({ title, description }: { title: string; description: string }) {
  return (
    <View className="gap-2">
      <Text variant="h1">{title}</Text>
      <Text color="mutedForeground">{description}</Text>
    </View>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <View className="h-px flex-1 bg-border" />
      <Text variant="label" color="faintForeground">
        {label}
      </Text>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}

/** A01's training-ring illustration (decorative, drawn in theme tokens). */
function WelcomeRings() {
  const { colors } = useTheme();
  const t = useTranslations("auth.welcome.illustration");
  const ring = (r: number, width: number, color: string, dash: string) => (
    <>
      <Circle cx={171} cy={93} r={r} stroke={colors.surfaceElevated} strokeWidth={width} />
      <Circle
        cx={171}
        cy={93}
        r={r}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dash}
        transform="rotate(-90 171 93)"
      />
    </>
  );
  const label = {
    fill: colors.faintForeground,
    fontFamily: "JetBrainsMono_400Regular",
    fontSize: 10,
    letterSpacing: 1.2,
  };

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Svg width="100%" height={186} viewBox="0 0 342 186" fill="none">
        {ring(86, 14, colors.primary, "380 541")}
        {ring(62, 10, colors.accentBorder, "250 390")}
        {ring(42, 6, colors.accentForeground, "90 264")}
        <SvgText
          x={171}
          y={101}
          textAnchor="middle"
          fill={colors.foreground}
          fontFamily="Unbounded_600SemiBold"
          fontSize={22}
        >
          {t("round")}
        </SvgText>
        <SvgText x={8} y={40} {...label}>
          {t("labelRound").toUpperCase()}
        </SvgText>
        <SvgText x={8} y={56} {...label}>
          {t("labelCamp").toUpperCase()}
        </SvgText>
        <SvgText x={276} y={150} {...label}>
          {t("labelJourney").toUpperCase()}
        </SvgText>
      </Svg>
    </View>
  );
}

/** A01 "Join the boxing community.": Google, Apple (iOS) or email. */
export function WelcomeScreen() {
  const t = useTranslations("auth.welcome");
  const router = useRouter();
  const returnTo = useReturnTo();

  return (
    <AuthFrame
      gutter="px-6"
      actions={
        <>
          <GoogleSignInButton />
          <AppleSignInButton />
          <Button
            label={t("email")}
            icon={Mail}
            variant="quiet"
            size="lg"
            onPress={() => router.push(withReturnTo("mobile.signup", returnTo))}
          />
          <TextLinks color="faintForeground" center>
            {`${t("haveAccount")} `}
            {linkTo(() => router.push(withReturnTo("mobile.login", returnTo)))(t("signIn"))}
          </TextLinks>
        </>
      }
    >
      <View className="gap-5">
        <BrandLockup />
        <WelcomeRings />
        <Text variant="authHero">
          {t.rich("title", {
            hl: (chunks) => (
              <Text variant="authHero" color="highlight">
                {chunks}
              </Text>
            ),
          })}
        </Text>
        <Text variant="bodyLg" color="mutedForeground">
          {t("description")}
        </Text>
      </View>
    </AuthFrame>
  );
}

/** O01b "Welcome back": Google and Apple side by side, or an email sign-in code. */
export function LoginScreen() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const returnTo = useReturnTo();

  return (
    <AuthFrame
      back={withReturnTo("mobile.welcome", returnTo)}
      actions={
        <TextLinks center>
          {`${t("newHere")} `}
          {linkTo(() => router.replace(withReturnTo("mobile.welcome", returnTo)))(t("join"))}
        </TextLinks>
      }
    >
      <Heading title={t("title")} description={t("description")} />
      <View className="flex-row gap-2.5">
        <View className="flex-1">
          <GoogleSignInButton variant="quiet" compact />
        </View>
        <AppleSlot />
      </View>
      <Divider label={t("orEmail")} />
      <SignInEmailForm returnTo={returnTo} submitLabel={t("emailSubmit")} hint={t("emailHint")} />
    </AuthFrame>
  );
}

/** Apple renders only on iOS with Sign in with Apple available; the slot collapses otherwise. */
function AppleSlot() {
  if (Platform.OS !== "ios") return null;
  return (
    <View className="flex-1">
      <AppleSignInButton variant="quiet" compact />
    </View>
  );
}

const codeLayout =
  (back: Href): CodeStepLayout =>
  // eslint-disable-next-line react/display-name -- a layout callback, not a component
  ({ body, actions }) => (
    <AuthFrame back={back} actions={actions}>
      {body}
    </AuthFrame>
  );

/** O01c "Enter your sign-in code" (email_sign_in). */
export function SignInCodeScreen() {
  const returnTo = useReturnTo();
  return (
    <SignInCodeStep
      returnTo={returnTo}
      layout={codeLayout(withReturnTo("mobile.login", returnTo))}
    />
  );
}

/** O02 "Create your account": email only (the registration API owns the address only). */
export function SignUpScreen() {
  const t = useTranslations("auth.signup");
  const returnTo = useReturnTo();

  return (
    <AuthFrame
      back={withReturnTo("mobile.welcome", returnTo)}
      actions={
        <>
          <Divider label={t("or")} />
          <View className="flex-row gap-2.5">
            <AppleSlot />
            <View className="flex-1">
              <GoogleSignInButton variant="quiet" compact />
            </View>
          </View>
        </>
      }
    >
      <Heading title={t("title")} description={t("description")} />
      <RegistrationEmailForm returnTo={returnTo} submitLabel={t("submit")} hint={t("hint")}>
        <Notice tone="olive" icon={Mail}>
          {t("noPassword")}
        </Notice>
      </RegistrationEmailForm>
    </AuthFrame>
  );
}

/** O03 "Verify your email" (email_verification). */
export function VerifyEmailScreen() {
  const returnTo = useReturnTo();
  return (
    <RegistrationCodeStep
      returnTo={returnTo}
      layout={codeLayout(withReturnTo("mobile.signup", returnTo))}
    />
  );
}
