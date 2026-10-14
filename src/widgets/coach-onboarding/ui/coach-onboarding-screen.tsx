import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Check, ChevronLeft, CircleAlert, TriangleAlert } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
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
import { useTranslations } from "use-intl";

import { useAccountProfile } from "@/entities/account-profile";
import {
  useCoachProfile,
  useCoachProfileActions,
  type CoachProfile,
} from "@/entities/coach-profile";
import {
  CompleteStep,
  FORM_STEPS,
  ProfileStep,
  REQUIREMENT_STEP,
  TypeStep,
  decideStep,
  nameSuggestion,
  rejectionOf,
  stepErrors,
  stepPatch,
  valuesFrom,
  type CoachField,
  type CoachValues,
  type Errors,
  type FormStepId,
  type StepId,
} from "@/features/coach-onboarding";
import { chooseEntryContext } from "@/features/session-gate";
import {
  continuationOf,
  continuationQuery,
  withContinuation,
  type Continuation,
} from "@/shared/routes/continuation";
import { routeHref } from "@/shared/routes/routes";
import { Button } from "@/shared/ui/button";
import { FieldFocus } from "@/shared/ui/field-focus";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { Spinner } from "@/shared/ui/spinner";
import { Text } from "@/shared/ui/text";

/*
 * The Coach mobile registration (`mobile.onboarding.coach`, SF-53; Claude
 * Design COACH 3, OC1 → OC2 → OC11, version 1791966129-8ecb) on the SF-50
 * CoachProfile and the SF-51 entry. The `?step=` param is navigation only;
 * the profile, the resume step and completion come from the backend
 * (`features/coach-onboarding/model/steps`). OC3–OC10 are FUTURE and never
 * shown.
 *
 * - Continue on OC1 checks the step, saves only the fields changed there and
 *   moves on once the backend kept them; a failure stays with the values
 *   typed. Finish on OC2 saves its changes, then asks the backend to complete
 *   onboarding; only that success shows OC11.
 * - Edits live as a diff over the backend profile, so a refetch (the app
 *   returns to the foreground after the web client saved) updates untouched
 *   fields and keeps unsaved edits. Nothing is kept on the device.
 * - A new, unsaved profile offers the account's full name as an editable
 *   coach name; it is saved only with the step and never written back.
 * - OC11's action records the Coach context (SF-51) and asks the entry with
 *   the Coach intent, which leads to Coach home.
 *
 * The OnboardingGate of the onboarding shell has already sent anyone with an
 * incomplete account registration to O04, carrying the Coach intent.
 */

export function CoachOnboardingScreen() {
  const t = useTranslations("coachOnboarding");
  const query = useCoachProfile();

  // A profile cached from an earlier visit may be outdated (completed or
  // edited on another client): no step is decided before a fresh read.
  const settling = !query.isFetchedAfterMount && query.isFetching;
  if (query.data === undefined || settling) {
    // No step is known before the profile arrives: no header, label or progress.
    return (
      <View className="flex-1 justify-center gap-3 bg-background px-5">
        {query.isError ? (
          <>
            <Notice tone="coral" icon={CircleAlert} live>
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

type Problem =
  | { kind: "save" }
  | { kind: "complete" }
  | { kind: "missing"; step: FormStepId; fields: CoachField[] };

type Opening = "idle" | "opening" | "failed";

/** OC1's fields in reading order: the first invalid one takes focus. */
const FOCUS_ORDER: readonly CoachField[] = [
  "display_name",
  "brand_name",
  "country_code",
  "city",
  "bio",
  "languages",
];

/** The entry with the Coach intent: Coach home once COACH exists, otherwise the Coach journey. */
const coachEntry = (continuation: Continuation) =>
  routeHref("mobile.root", {}, continuationQuery({ ...continuation, intent: "coach" }));

function Flow({ profile: queried }: { profile: CoachProfile }) {
  const t = useTranslations("coachOnboarding");
  const router = useRouter();
  const params = useLocalSearchParams<{ step?: string }>();
  const [continuation] = useState(() => continuationOf(params));
  const { save, complete } = useCoachProfileActions();
  const [edits, setEdits] = useState<Partial<CoachValues>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [focus, setFocus] = useState<{ field: CoachField }>();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>();
  const [justCompleted, setJustCompleted] = useState(false);
  const [opening, setOpening] = useState<Opening>("idle");
  const scroll = useRef<ScrollView>(null);
  const revealTop = useCallback(() => {
    scroll.current?.scrollTo({ y: 0, animated: true });
  }, []);
  // A write's answer, used until the query delivers it (its observers are
  // notified a tick later): the step decided right after a save must see the
  // saved profile, or it would send the person back. It applies only while
  // the query still holds the profile it was written over.
  const [written, setWritten] = useState<{ profile: CoachProfile; over: CoachProfile }>();
  const profile = written?.over === queried ? written.profile : queried;

  // The account-name suggestion: only for a new profile with no saved name
  // and while the person has not typed their own. It is a value of the form,
  // saved only with the step; a name saved elsewhere meanwhile replaces it
  // (the profile is no longer new), and the account is never written.
  const suggestible = profile.onboarding.status === "not_started" && profile.display_name === null;
  const account = useAccountProfile({ enabled: suggestible });
  const suggestion = nameSuggestion(profile, account.data?.full_name);
  const suggesting = suggestion !== undefined && edits.display_name === undefined;

  const values: CoachValues = {
    ...valuesFrom(profile),
    ...(suggesting ? { display_name: suggestion } : {}),
    ...edits,
  };
  const decision = decideStep(profile, params.step, justCompleted);
  const step: StepId = decision.kind === "step" ? decision.step : "profile";

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
    if (step === "complete") return;
    if (step === "type") go("profile");
    else if (router.canGoBack()) router.back();
    else router.replace(withContinuation("mobile.onboarding.role", continuation));
  }, [continuation, go, router, step]);

  const openCoachHome = useCallback(async () => {
    if (opening === "opening") return;
    setOpening("opening");
    try {
      await chooseEntryContext("coach");
      router.replace(coachEntry(continuation));
    } catch {
      // The profile stays completed; the person can try again.
      setOpening("failed");
    }
  }, [continuation, opening, router]);

  // Android's back button walks the steps like the header's Back; on OC11
  // (completion is final) it continues through the entry with the Coach intent.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step === "profile") return false;
      if (step === "complete") router.replace(coachEntry(continuation));
      else back();
      return true;
    });
    return () => subscription.remove();
  }, [back, continuation, router, step]);

  const change = useCallback(<K extends CoachField>(field: K, value: CoachValues[K]) => {
    setEdits((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const dirty = Object.fromEntries(
    [...Object.keys(edits), ...(suggesting ? ["display_name"] : [])].map((field) => [field, true]),
  );

  function reject(found: Errors) {
    setErrors(found);
    const field = FOCUS_ORDER.find((candidate) => found[candidate] !== undefined);
    setFocus(field === undefined ? undefined : { field });
  }

  /** Saves the step's changed, valid fields; resolves whether the step may be left. */
  async function saveStep(formStep: FormStepId): Promise<boolean> {
    const found = stepErrors(formStep, values);
    const patch = stepPatch(formStep, values, dirty, found);
    if (Object.keys(patch).length > 0) {
      try {
        setWritten({ profile: await save(patch), over: queried });
        setEdits((current) => {
          const next = { ...current };
          for (const field of Object.keys(patch) as CoachField[]) delete next[field];
          return next;
        });
      } catch (error) {
        const rejected = rejectionOf(error);
        if (rejected === undefined) setProblem({ kind: "save" });
        else reject({ ...found, ...rejected.fields });
        return false;
      }
    }
    if (Object.keys(found).length > 0) {
      reject(found);
      return false;
    }
    return true;
  }

  async function finish() {
    // Set first: the backend's completed profile reaches the cache before
    // `complete()` resolves, and must render as OC11, not as an exit. OC11
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
        // Account registration (SF-44) first: the entry sends the person to O04, Coach intent kept.
        router.replace(coachEntry(continuation));
        return;
      }
      const fields = (rejected?.missing ?? []).filter(
        (field): field is keyof typeof REQUIREMENT_STEP => field in REQUIREMENT_STEP,
      );
      const first = fields
        .map((field) => REQUIREMENT_STEP[field])
        .sort((a, b) => FORM_STEPS.indexOf(a) - FORM_STEPS.indexOf(b))[0];
      if (first === undefined) setProblem({ kind: "complete" });
      else if (first === "type") reject(rejected?.fields ?? {});
      else setProblem({ kind: "missing", step: first, fields });
    }
  }

  async function advance() {
    if (busy || step === "complete") return;
    Keyboard.dismiss();
    setProblem(undefined);
    setBusy(true);
    try {
      if (!(await saveStep(step))) return;
      if (step === "type") await finish();
      else go("type");
    } finally {
      setBusy(false);
    }
  }

  if (decision.kind === "exit") return <Redirect href={coachEntry(continuation)} />;

  const missingNames = (fields: CoachField[]) =>
    fields
      .filter((field) => field !== "coaching_formats")
      .map((field) => t(`missing.fields.${field as "display_name" | "country_code" | "city"}`))
      .join(", ");

  return (
    <>
      {/* The steps share one screen: iOS swipe-back would leave the whole flow,
          so it is offered only on OC1, where Back leaves it too. */}
      <Stack.Screen options={{ gestureEnabled: step === "profile" }} />
      <StepFrame
        scroll={scroll}
        step={step}
        busy={busy}
        onBack={step === "complete" ? undefined : back}
        actions={
          step === "complete" ? (
            <Button
              label={t(opening === "failed" ? "done.retry" : "done.continue")}
              size="lg"
              loading={opening === "opening"}
              onPress={() => void openCoachHome()}
            />
          ) : (
            <Button
              label={step === "type" ? t("finish") : t("continue")}
              size="lg"
              loading={busy}
              onPress={() => void advance()}
            />
          )
        }
      >
        <>
          {problem?.kind === "missing" && (
            <View className="gap-2">
              <Notice tone="amber" icon={TriangleAlert} live>
                {t("missing.body", { fields: missingNames(problem.fields) })}
              </Notice>
              <Button
                label={t("missing.goProfile")}
                variant="quiet"
                onPress={() => go(problem.step)}
              />
            </View>
          )}
          {step === "profile" && (
            <ProfileStep
              values={values}
              errors={errors}
              disabled={busy}
              onChange={change}
              suggested={suggesting}
              focus={focus}
              onRevealTop={revealTop}
            />
          )}
          {step === "type" && (
            <TypeStep values={values} errors={errors} disabled={busy} onChange={change} />
          )}
          {step === "complete" && <CompleteStep profile={profile} />}
          {step === "complete" && opening === "failed" && (
            <Notice tone="amber" icon={TriangleAlert} live>
              {t("done.failed")}
            </Notice>
          )}
          {(problem?.kind === "save" || problem?.kind === "complete") && (
            <Notice tone="coral" icon={CircleAlert} live>
              {t(problem.kind === "save" ? "errors.saveFailed" : "errors.completeFailed")}
            </Notice>
          )}
        </>
      </StepFrame>
    </>
  );
}

/**
 * The OC1, OC2 and OC11 frame: a 44 pt back button and "STEP n OF 2 ·
 * SECTION" (OC11: "COACH · DONE", no back), the two-segment progress bar, the
 * heading and line, the scrolling body on 20 pt gutters and the action pinned
 * above the home indicator. Insets are runtime values (the only `style`).
 */
function StepFrame({
  scroll,
  step,
  busy,
  onBack,
  actions,
  children,
}: {
  scroll: RefObject<ScrollView | null>;
  step: StepId;
  busy: boolean;
  onBack?: (() => void) | undefined;
  actions: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("coachOnboarding");
  const insets = useSafeAreaInsets();
  const content = useRef<View>(null);
  const total = FORM_STEPS.length;
  const position = step === "complete" ? total : FORM_STEPS.indexOf(step) + 1;

  // A new step starts at its top.
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [scroll, step]);

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
      // Room for the field's message under it.
      const bottom = y + height + 48;
      if (bottom > offset.current + viewport.current || y < offset.current) {
        scroll.current?.scrollTo({ y: Math.max(0, bottom - viewport.current), animated: true });
      }
    });
  }, [scroll]);
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
                  {step === "complete"
                    ? t("doneLabel")
                    : t("stepLabel", {
                        step: position,
                        total,
                        section: t(`sections.${step}`),
                      })}
                </Text>
                <View className="w-7.5" />
              </View>
              <View
                className="flex-row gap-1"
                accessibilityRole="progressbar"
                accessibilityLabel={
                  step === "complete" ? t("progressDone") : t("progress", { step: position, total })
                }
                accessibilityValue={{ min: 1, max: total, now: position }}
              >
                {FORM_STEPS.map((item, index) => (
                  <View
                    key={item}
                    className={`h-1 flex-1 rounded-full ${index + 1 < position || step === "complete" ? "bg-highlight" : index + 1 === position ? "bg-primary" : "bg-border"}`}
                  />
                ))}
              </View>
            </View>
            {step === "complete" && (
              // OC11: the completion mark sits above the heading.
              <View className="size-16 items-center justify-center rounded-3xl bg-primary">
                <Icon icon={Check} size={32} color="primaryForeground" />
              </View>
            )}
            <View className="gap-2">
              <Text variant="h1" accessibilityRole="header">
                {t(`titles.${step}`)}
              </Text>
              <Text color="mutedForeground">{t(`descriptions.${step}`)}</Text>
            </View>
            <FieldFocus.Provider value={revealSoon}>{children}</FieldFocus.Provider>
          </View>
        </ScrollView>
        <View
          className="gap-2.5 px-5 pt-3"
          // Runtime inset: the artboards keep the action 34 pt above the bottom edge.
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          {actions}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
