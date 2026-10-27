import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import {
  ChevronLeft,
  CircleAlert,
  HandFist,
  House,
  LogOut,
  Mail,
  Star,
  UserCheck,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
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
import { useSession } from "@/entities/session";
import { AccountBasicsForm } from "@/features/account-registration";
import { useEntryChoice } from "@/features/session-gate";
import { AppleSignInButton } from "@/features/sign-in-with-apple";
import { GoogleSignInButton } from "@/features/sign-in-with-google";
import { SignOutButton } from "@/features/sign-out";
import { publicEnv } from "@/shared/config/env";
import {
  continuationOf,
  withContinuation,
  type Continuation,
  type EntryIntent,
} from "@/shared/routes/continuation";
import { useTheme } from "@/shared/styles/theme";
import { BrandLockup } from "@/shared/ui/brand-mark";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Input } from "@/shared/ui/input";
import { Notice } from "@/shared/ui/notice";
import { Text } from "@/shared/ui/text";
import { linkTo, TextLinks } from "@/shared/ui/text-link";

/*
 * The mobile.auth screens (Claude Design onboarding page, 390 × 844): A01
 * Welcome, O01b Sign in, O01c Sign-in code, O02 Create account, O03 Verify
 * email, O04 Basics & consent and O05 Choose your role (SF-37). Every sign-in method ends in the shared session pipeline; the
 * auth shell's SessionGate then enters the application through the backend
 * entry resolution, carrying `returnTo` and `intent` (SF-45). Deferred until their domain exists (SF-25 and the
 * recovery/invite tickets): O02 full name, O01b "Recover account", A01
 * invite and brands links, and the workspace destinations (A03, A04).
 */

/**
 * The valid continuation of the current auth screen (`returnTo` under the
 * SF-24 policy and the allow-listed `intent`, SF-45), carried between steps.
 */
function useContinuation(): Continuation {
  return continuationOf(useLocalSearchParams());
}

/** Whether the software keyboard is shown (iOS reports it before it moves, Android after). */
function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () =>
      setShown(true),
    );
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () =>
      setShown(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

/**
 * Frame of the designed auth screens: a 44 pt back button and the content on
 * 20 pt gutters, the main actions pinned above the home indicator. Insets are
 * runtime values (the only `style`).
 *
 * `secondaryActions`: the pinned row holds only navigation away (O01b "New
 * here? Join") while the screen's submit scrolls with its field. The row then
 * steps aside while the keyboard is up; pinned above the keyboard it would
 * cover the lower part of that submit, and a tap meant for it would leave.
 */
function AuthFrame({
  back,
  headerAction,
  children,
  actions,
  secondaryActions = false,
  gutter = "px-5",
}: {
  back?: Href;
  /** Right end of the header row (the signed-in setup screens' Sign out, SF-28). */
  headerAction?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  secondaryActions?: boolean;
  gutter?: "px-5" | "px-6";
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTranslations("auth.login");
  const typing = useKeyboardShown();

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
        {(back !== undefined || headerAction !== undefined) && (
          <View className="flex-row items-center justify-between gap-3">
            {back !== undefined ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("back")}
                onPress={() => (router.canGoBack() ? router.back() : router.replace(back))}
                className="size-11 items-center justify-center rounded-full border border-border bg-surface"
              >
                <Icon icon={ChevronLeft} />
              </Pressable>
            ) : (
              <View />
            )}
            {headerAction}
          </View>
        )}
        {children}
      </ScrollView>
      {actions !== undefined && !(secondaryActions && typing) && (
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

/**
 * Why the welcome or sign-in screen is shown, when a session ended in this
 * launch (SF-28): the API rejected it (`expired`), or the user signed out.
 * "Signed out on this device" stays true even when the logout could not reach
 * the API, so nothing claims a server revocation that did not happen.
 */
function SessionEndedNotice() {
  const t = useTranslations("auth.session.ended");
  const { status, ended } = useSession();
  if (status !== "anonymous" || ended === undefined) return null;
  return ended === "expired" ? (
    <Notice tone="amber" icon={CircleAlert} live>
      {t("expired")}
    </Notice>
  ) : (
    <Notice tone="muted" icon={LogOut} live>
      {t("signedOut")}
    </Notice>
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
  const continuation = useContinuation();

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
            onPress={() => router.push(withContinuation("mobile.signup", continuation))}
          />
          <TextLinks color="faintForeground" center>
            {`${t("haveAccount")} `}
            {linkTo(() => router.push(withContinuation("mobile.login", continuation)))(t("signIn"))}
          </TextLinks>
        </>
      }
    >
      <View className="gap-5">
        <BrandLockup />
        <SessionEndedNotice />
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
  const continuation = useContinuation();

  return (
    <AuthFrame
      back={withContinuation("mobile.welcome", continuation)}
      secondaryActions
      actions={
        <TextLinks center>
          {`${t("newHere")} `}
          {linkTo(() => router.replace(withContinuation("mobile.welcome", continuation)))(
            t("join"),
          )}
        </TextLinks>
      }
    >
      <Heading title={t("title")} description={t("description")} />
      <SessionEndedNotice />
      <View className="flex-row gap-2.5">
        <View className="flex-1">
          <GoogleSignInButton variant="quiet" compact />
        </View>
        <AppleSlot />
      </View>
      <Divider label={t("orEmail")} />
      <SignInEmailForm
        continuation={continuation}
        submitLabel={t("emailSubmit")}
        hint={t("emailHint")}
      />
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
  const continuation = useContinuation();
  return (
    <SignInCodeStep
      continuation={continuation}
      layout={codeLayout(withContinuation("mobile.login", continuation))}
    />
  );
}

/** O02 "Create your account": email only (the registration API owns the address only). */
export function SignUpScreen() {
  const t = useTranslations("auth.signup");
  const continuation = useContinuation();

  return (
    <RegistrationEmailForm
      continuation={continuation}
      submitLabel={t("submit")}
      hint={t("hint")}
      leadingFields={
        // O02 draws Full name above Email. Presentation only: the
        // registration API owns the address only (SF-25 owns the profile).
        <Input label={t("fullName")} editable={false} presentational />
      }
      layout={({ fields, submit }) => (
        <AuthFrame
          back={withContinuation("mobile.welcome", continuation)}
          actions={
            <>
              {submit}
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
          {fields}
        </AuthFrame>
      )}
    >
      <Notice tone="olive" icon={Mail}>
        {t("noPassword")}
      </Notice>
    </RegistrationEmailForm>
  );
}

/** O03 "Verify your email" (email_verification). */
export function VerifyEmailScreen() {
  const continuation = useContinuation();
  return (
    <RegistrationCodeStep
      continuation={continuation}
      layout={codeLayout(withContinuation("mobile.signup", continuation))}
    />
  );
}

/** O04 "A few basics": SF-44 account registration (`mobile.signup.consent`). */
export function ConsentScreen() {
  return (
    <AccountBasicsForm
      layout={({ body, actions }) => (
        <AuthFrame actions={actions} headerAction={<SignOutButton variant="ghost" />}>
          {body}
        </AuthFrame>
      )}
    />
  );
}

const JOURNEYS: readonly { intent: EntryIntent; icon: LucideIcon }[] = [
  { intent: "fighter", icon: HandFist },
  { intent: "coach", icon: UserCheck },
  { intent: "gym", icon: House },
  { intent: "sponsor", icon: Star },
];

/**
 * O05 "How will you use SimpleFit?" (`mobile.onboarding.role`), on the SF-45
 * entry resolver, as the web WA6: one choice of four journeys and nothing
 * picked by default (an explicit `intent=sponsor`, whose application starts
 * here, preselects Sponsor). Continue asks the resolver again with the
 * chosen intent and goes where it answers; nothing is stored or created.
 *
 * The Sponsor / Brand application is on the web (mobile has no sponsor
 * surface): the choice opens the web partner application. The artboard's
 * invite links wait for the invite domain (A03).
 */
export function RoleChoiceScreen() {
  const t = useTranslations("auth.role");
  const continuation = useContinuation();
  const [picked, setPicked] = useState<EntryIntent | undefined>(
    continuation.intent === "sponsor" ? "sponsor" : undefined,
  );
  const [handoff, setHandoff] = useState<"unavailable" | "failed">();

  const openSponsor = useCallback(async () => {
    if (publicEnv.webUrl === undefined) {
      setHandoff("unavailable");
      return;
    }
    try {
      await Linking.openURL(`${publicEnv.webUrl}/partners/apply`);
      setHandoff(undefined);
    } catch {
      setHandoff("failed");
    }
  }, []);

  const { state, choose } = useEntryChoice(continuation, openSponsor);
  const busy = state.status === "resolving";
  const failed = state.status === "failed" ? state : undefined;

  return (
    <AuthFrame
      headerAction={<SignOutButton variant="ghost" />}
      actions={
        <Button
          label={
            busy ? t("opening") : picked === undefined ? t("continue") : t(`journeys.${picked}.cta`)
          }
          size="lg"
          disabled={picked === undefined}
          loading={busy}
          accessibilityHint={picked === undefined ? t("hint") : undefined}
          onPress={() => {
            setHandoff(undefined);
            if (picked !== undefined) void choose(picked);
          }}
        />
      }
    >
      <View className="gap-2">
        <Text variant="h1" accessibilityRole="header">
          {t("title")}
        </Text>
        <Text color="mutedForeground">{t("description")}</Text>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={t("groupLabel")} className="gap-2.5">
        {JOURNEYS.map(({ intent, icon }) => (
          <JourneyCard
            key={intent}
            icon={icon}
            title={t(`journeys.${intent}.title`)}
            body={t(`journeys.${intent}.body`)}
            checked={picked === intent}
            disabled={busy}
            onPress={() => setPicked(intent)}
          />
        ))}
      </View>
      {picked === undefined && (
        <Text variant="caption" color="faintForeground">
          {t("hint")}
        </Text>
      )}
      {failed !== undefined && (
        <Notice tone="amber" icon={CircleAlert}>
          {failed.reason === "unexpected" ? t("failure.unexpected") : t("failure.body")}
        </Notice>
      )}
      {handoff !== undefined && (
        <Notice tone="amber" icon={CircleAlert}>
          {t(`sponsor.${handoff}`)}
        </Notice>
      )}
    </AuthFrame>
  );
}

/** One O05 journey: the 42 pt icon tile, title and line, and the radio ring. */
function JourneyCard({
  icon,
  title,
  body,
  checked,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  checked: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityHint={body}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-2xl px-4 py-3.5 ${checked ? "border-[1.5px] border-highlight bg-accent" : "border border-border bg-surface"}`}
    >
      <View
        className={`size-10.5 items-center justify-center rounded-md-lg ${checked ? "bg-accent-strong" : "bg-muted"}`}
      >
        <Icon icon={icon} size={20} color={checked ? "accentForeground" : "mutedForeground"} />
      </View>
      <View className="flex-1 gap-1">
        <Text
          variant="bodyLg"
          weight="extrabold"
          color={checked ? "accentForeground" : "foreground"}
        >
          {title}
        </Text>
        <Text variant="caption" color={checked ? "accentMutedForeground" : "mutedForeground"}>
          {body}
        </Text>
      </View>
      <View
        className={`size-5.5 items-center justify-center rounded-full border-2 ${checked ? "border-highlight" : "border-border-strong"}`}
      >
        {checked ? <View className="size-2.5 rounded-full bg-highlight" /> : null}
      </View>
    </Pressable>
  );
}
