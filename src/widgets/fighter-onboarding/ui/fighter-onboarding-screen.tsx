import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, CircleAlert } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale, useTranslations } from "use-intl";

import {
  useFighterProfile,
  useFighterProfileActions,
  type FighterProfile,
} from "@/entities/fighter-profile";
import {
  AccountStep,
  CompleteStep,
  ExperienceStep,
  FieldFocus,
  FINAL_STEP,
  GoalsStep,
  InfoStep,
  REQUIREMENT_STEP,
  STEPS,
  STEP_FIELDS,
  TOTAL_STEPS,
  WeightStep,
  decideStep,
  nextStep,
  previousStep,
  rejectionOf,
  stepErrors,
  stepIndex,
  stepPatch,
  valuesFrom,
  type Errors,
  type FighterField,
  type FighterValues,
  type FormStepId,
  type InfoStepId,
  type StepId,
} from "@/features/fighter-onboarding";
import { maskedFromIso } from "@/shared/lib/date-input";
import { continuationOf, withContinuation } from "@/shared/routes/continuation";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { Spinner } from "@/shared/ui/spinner";
import { Text } from "@/shared/ui/text";

/*
 * The Fighter mobile registration (`mobile.onboarding.fighter`, SF-39;
 * Claude Design FIGHTER 2, OF1–OF11 at 390 × 844) on the SF-25
 * FighterProfile. The `?step=` param is navigation only; the profile, the
 * resume step and completion come from the backend (`model/steps`).
 *
 * - Continue on OF1–OF4 checks the step, saves only the fields the person
 *   changed there and moves on once the backend kept them; a failure stays
 *   with the values typed.
 * - Skip moves on without saving that step; OF5–OF10 record nothing.
 * - The last step (OF10) asks the backend to complete onboarding; only its
 *   success shows OF11. A rejection names what is missing and offers the
 *   step that asks for it.
 * - Edits live as a diff over the backend profile, so a refetch (the app
 *   returns to the foreground after the web client saved) updates untouched
 *   fields and keeps unsaved edits. Nothing is kept on the device.
 *
 * The OnboardingGate of the onboarding shell has already sent anyone with an
 * incomplete account registration to O04.
 */

export function FighterOnboardingScreen() {
  const t = useTranslations("fighterOnboarding");
  const query = useFighterProfile();

  // A profile cached from an earlier visit may be outdated (completed or
  // edited on another client): no step is decided before a fresh read.
  const settling = !query.isFetchedAfterMount && query.isFetching;
  if (query.data === undefined || settling) {
    // No step is known before the profile arrives: no header, label or progress.
    return (
      <View className="flex-1 justify-center gap-3 bg-background px-5">
        {query.isError ? (
          <>
            <Notice tone="coral" icon={CircleAlert}>
              {t("loadFailed")}
            </Notice>
            <Button label={t("retry")} variant="quiet" onPress={() => void query.refetch()} />
          </>
        ) : (
          <Spinner label={t("loading")} />
        )}
      </View>
    );
  }
  return <Flow profile={query.data} />;
}

type Problem = { kind: "save" } | { kind: "complete" } | { kind: "missing"; step: FormStepId };

function Flow({ profile: queried }: { profile: FighterProfile }) {
  const t = useTranslations("fighterOnboarding");
  const router = useRouter();
  const locale = useLocale();
  const params = useLocalSearchParams<{ step?: string }>();
  const { save, complete } = useFighterProfileActions();
  const [edits, setEdits] = useState<Partial<FighterValues>>({});
  const [dateText, setDateText] = useState(() =>
    maskedFromIso(queried.next_fight_on ?? "", locale),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>();
  const [justCompleted, setJustCompleted] = useState(false);
  // A write's answer, used until the query delivers it (its observers are
  // notified a tick later): the step decided right after a save must see
  // the saved profile, or it would send the person back.
  // It applies only while the query still holds the profile it was written
  // over; any newer query result replaces it.
  const [written, setWritten] = useState<{ profile: FighterProfile; over: FighterProfile }>();
  const profile = written?.over === queried ? written.profile : queried;

  const values: FighterValues = { ...valuesFrom(profile), ...edits };
  const decision = decideStep(profile, params.step, justCompleted);
  const step = decision.kind === "step" ? decision.step : "account";

  // Keep the URL on the step actually shown (a resume step, or a corrected link).
  useEffect(() => {
    if (decision.kind === "step" && params.step !== decision.step) {
      router.setParams({ step: decision.step });
    }
  }, [decision, params.step, router]);

  const go = useCallback(
    (to: StepId) => {
      setErrors({});
      setProblem(undefined);
      router.setParams({ step: to });
    },
    [router],
  );

  const back = useCallback(() => {
    const previous = previousStep(step);
    if (step === "complete") return;
    if (previous !== undefined) go(previous);
    else if (router.canGoBack()) router.back();
    else router.replace(withContinuation("mobile.onboarding.role", continuationOf(params)));
  }, [go, params, router, step]);

  // Android's back button walks the steps like the header's Back; on OF11
  // (completion is final) it continues to the entry, like the action.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step === "account") return false;
      if (step === "complete") router.replace("/");
      else back();
      return true;
    });
    return () => subscription.remove();
  }, [back, router, step]);

  const change = useCallback(<K extends FighterField>(field: K, value: FighterValues[K]) => {
    setEdits((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const dirty = Object.fromEntries(Object.keys(edits).map((field) => [field, true]));

  /** Saves the step's changed, valid fields; resolves whether the step may be left. */
  async function saveStep(formStep: FormStepId): Promise<boolean> {
    const found = stepErrors(formStep, values, dateText);
    const patch = stepPatch(formStep, values, dirty, found);
    if (Object.keys(patch).length > 0) {
      try {
        setWritten({ profile: await save(patch), over: queried });
        setEdits((current) => {
          const next = { ...current };
          for (const field of Object.keys(patch) as FighterField[]) delete next[field];
          return next;
        });
      } catch (error) {
        const rejected = rejectionOf(error);
        if (rejected === undefined) setProblem({ kind: "save" });
        else setErrors({ ...found, ...rejected.fields });
        return false;
      }
    }
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return false;
    }
    return true;
  }

  async function finish() {
    // Set first: the backend's completed profile reaches the cache before
    // `complete()` resolves, and must render as OF11, not as an exit. OF11
    // still needs that profile's `completed` status, so it never shows unless
    // the backend completed onboarding.
    setJustCompleted(true);
    try {
      setWritten({ profile: await complete(), over: queried });
      go("complete");
    } catch (error) {
      setJustCompleted(false);
      const rejected = rejectionOf(error);
      if (rejected?.accountRegistration) {
        // Account registration (SF-44) first: the entry resolver sends the person to O04.
        router.replace("/");
        return;
      }
      const missing = rejected?.missing
        .map((field) => REQUIREMENT_STEP[field as keyof typeof REQUIREMENT_STEP])
        .filter((value): value is FormStepId => value !== undefined)
        .sort((a, b) => stepIndex(a) - stepIndex(b))[0];
      setProblem(missing === undefined ? { kind: "complete" } : { kind: "missing", step: missing });
    }
  }

  async function advance(skip: boolean) {
    if (busy) return;
    Keyboard.dismiss();
    setProblem(undefined);
    setBusy(true);
    try {
      const definition = STEPS[stepIndex(step)];
      if (definition?.kind === "form" && !skip) {
        if (!(await saveStep(step as FormStepId))) return;
      }
      if (definition?.kind === "form" && skip) {
        // Skipping leaves the step's unsaved changes behind.
        setEdits((current) => {
          const next = { ...current };
          for (const field of STEP_FIELDS[step as FormStepId]) delete next[field];
          return next;
        });
      }
      if (step === FINAL_STEP) await finish();
      else go(nextStep(step));
    } finally {
      setBusy(false);
    }
  }

  if (decision.kind === "exit") return <Redirect href="/" />;

  const definition = STEPS[stepIndex(step)];
  const isFinal = step === FINAL_STEP;

  return (
    <>
      {/* The steps share one screen: iOS swipe-back would leave the whole flow,
          so it is offered only on OF1, where Back leaves it too. */}
      <Stack.Screen options={{ gestureEnabled: step === "account" }} />
      <StepFrame
        step={step}
        busy={busy}
        onBack={step === "complete" ? undefined : back}
        onSkip={definition?.skippable ? () => void advance(true) : undefined}
        actions={
          step === "complete" ? (
            <Button label={t("complete.cta")} size="lg" onPress={() => router.replace("/")} />
          ) : (
            <Button
              label={isFinal ? t("finish") : t("continue")}
              size="lg"
              loading={busy}
              onPress={() => void advance(false)}
            />
          )
        }
      >
        {step === "account" && (
          <AccountStep values={values} errors={errors} disabled={busy} onChange={change} />
        )}
        {step === "experience" && (
          <ExperienceStep values={values} errors={errors} disabled={busy} onChange={change} />
        )}
        {step === "goals" && (
          <GoalsStep
            values={values}
            errors={errors}
            disabled={busy}
            onChange={change}
            dateText={dateText}
            onDateText={setDateText}
          />
        )}
        {step === "weight" && (
          <WeightStep values={values} errors={errors} disabled={busy} onChange={change} />
        )}
        {definition?.kind === "info" && <InfoStep id={step as InfoStepId} />}
        {step === "complete" && <CompleteStep profile={profile} />}
        {problem !== undefined && (
          <Notice tone="coral" icon={CircleAlert}>
            {problem.kind === "missing"
              ? t("errors.missing", { section: t(`sections.${problem.step}`) })
              : t(problem.kind === "save" ? "errors.saveFailed" : "errors.completeFailed")}
          </Notice>
        )}
        {problem?.kind === "missing" && (
          <Button
            label={t("errors.goTo", { section: t(`sections.${problem.step}`) })}
            variant="quiet"
            onPress={() => go(problem.step)}
          />
        )}
      </StepFrame>
    </>
  );
}

/**
 * The OF1–OF11 frame: a 44 pt back button, "STEP n OF 11 · SECTION" and Skip
 * where the artboard draws it, the eleven-segment progress bar, the heading
 * and line, the scrolling body on 20 pt gutters and the action pinned above
 * the home indicator. Insets are runtime values (the only `style`).
 */
function StepFrame({
  step,
  busy,
  onBack,
  onSkip,
  actions,
  children,
}: {
  step: StepId;
  busy: boolean;
  onBack?: (() => void) | undefined;
  onSkip?: (() => void) | undefined;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("fighterOnboarding");
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const position = stepIndex(step) + 1;

  const content = useRef<View>(null);

  // A new step starts at its top.
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  // iOS: the keyboard shrinks the page (KeyboardAvoidingView) but nothing
  // brings a lower field into view, so the focused field is scrolled just
  // into the visible part (never when it already shows). Android resizes and
  // scrolls by itself.
  const offset = useRef(0);
  const viewport = useRef(0);
  const reveal = useCallback(() => {
    if (Platform.OS !== "ios") return;
    const input = TextInput.State.currentlyFocusedInput();
    const container = content.current;
    if (!input || !container) return;
    input.measureLayout(container, (_x, y, _width, height) => {
      const bottom = y + height + 24;
      if (bottom > offset.current + viewport.current || y < offset.current) {
        scroll.current?.scrollTo({ y: Math.max(0, bottom - viewport.current), animated: true });
      }
    });
  }, []);
  // On focus the keyboard may still be rising: check once it has settled.
  const revealSoon = useCallback(() => {
    setTimeout(reveal, 350);
  }, [reveal]);
  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", reveal);
    return () => subscription.remove();
  }, [reveal]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      {/* Runtime inset: content scrolls below the status bar, never under it. */}
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        <ScrollView
          ref={scroll}
          scrollEventThrottle={16}
          onScroll={(event) => {
            offset.current = event.nativeEvent.contentOffset.y;
          }}
          onLayout={(event) => {
            viewport.current = event.nativeEvent.layout.height;
          }}
          keyboardShouldPersistTaps="handled"
          // The number pads have no return key: dragging the page dismisses them.
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          // The artboards' 58 pt top is the status bar plus 11 pt (nearest step: 12 pt).
          contentContainerClassName="grow px-5 pb-6 pt-3"
        >
          <View ref={content} className="grow gap-4">
            <View className="gap-3">
              <View className="flex-row items-center gap-3">
                {onBack ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("back")}
                    disabled={busy}
                    onPress={onBack}
                    className="size-11 items-center justify-center rounded-full border border-border bg-surface"
                  >
                    <Icon icon={ChevronLeft} />
                  </Pressable>
                ) : (
                  <View className="size-11" />
                )}
                <Text variant="label" color="faintForeground" className="flex-1">
                  {t("stepLabel", {
                    step: position,
                    total: TOTAL_STEPS,
                    section: t(`sections.${step}`),
                  })}
                </Text>
                {onSkip ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("skipStep", { section: t(`sections.${step}`) })}
                    disabled={busy}
                    onPress={onSkip}
                    hitSlop={12}
                    className="min-h-touch justify-center"
                  >
                    <Text variant="bodySm" weight="extrabold" color="mutedForeground">
                      {t("skip")}
                    </Text>
                  </Pressable>
                ) : (
                  <View className="w-7.5" />
                )}
              </View>
              <View
                className="flex-row gap-1"
                accessibilityRole="progressbar"
                accessibilityLabel={t("progress", { step: position, total: TOTAL_STEPS })}
                accessibilityValue={{ min: 1, max: TOTAL_STEPS, now: position }}
              >
                {STEPS.map((item, index) => (
                  <View
                    key={item.id}
                    className={`h-1 flex-1 rounded-full ${index + 1 < position ? "bg-highlight" : index + 1 === position ? "bg-primary" : "bg-border"}`}
                  />
                ))}
              </View>
            </View>
            <View className="gap-2">
              <Text variant="h1" accessibilityRole="header">
                {t(`titles.${step}`)}
              </Text>
              <Text color="mutedForeground">{t(`descriptions.${step}`)}</Text>
            </View>
            <FieldFocus.Provider value={revealSoon}>{children}</FieldFocus.Provider>
          </View>
        </ScrollView>
        {actions !== undefined && (
          <View
            className="gap-2.5 px-5 pt-3"
            // Runtime inset: the artboards keep the action 34 pt above the bottom edge.
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            {actions}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
