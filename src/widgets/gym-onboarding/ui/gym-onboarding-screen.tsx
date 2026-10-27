import { randomUUID } from "expo-crypto";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Check, ChevronLeft, CircleAlert } from "lucide-react-native";
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

import {
  useGymDraft,
  useGymSetup,
  useGymSetupActions,
  type GymSetup,
  type GymSetupPatch,
} from "@/entities/gym-setup";
import {
  BrandingStep,
  CreatedStep,
  LocationStep,
  REQUIREMENT_STEP,
  StepNotice,
  TypeStep,
  brandErrors,
  brandFrom,
  brandPatch,
  decideStep,
  gymErrors,
  gymFrom,
  gymPatch,
  locationChanged,
  locationErrors,
  locationFrom,
  locationInput,
  outcomeOf,
  type FieldMessage,
  type FormStep,
  type SetupErrors,
  type SetupField,
  type SetupValues,
  type Step,
  type StepAction,
  type StepProblem,
} from "@/features/gym-onboarding";
import { chooseEntryContext, entryHref, fetchEntry, isKnownEntry } from "@/features/session-gate";
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
 * The Gym owner mobile registration (`mobile.onboarding.gym`, SF-87): OG1
 * Gym name & type → OG2 Location → OG3 Branding → OG6b Gym created, on the
 * SF-83 / SF-84 / SF-85 APIs with the same semantics as the web (SF-86), in
 * the approved mobile onboarding frame (Claude Design COACH 3, 390 × 844)
 * with the approved SF-87 differences (docs/gym-onboarding-mobile.md).
 *
 * - The draft comes from `GET /me/gyms` (read on every screen entry, so a
 *   cold start reconciles with the server); its fields, revision and
 *   completion from the setup, re-read when the app returns to the
 *   foreground. `?step=` is navigation only.
 * - Edits live as a diff over the backend setup: a re-read updates untouched
 *   fields and keeps unsaved edits, so a stale revision never loses input.
 *   Nothing is kept on the device; the session boundary clears the cache.
 * - OG1 creates the draft with one key per attempt (`expo-crypto`), repeated
 *   by every retry and renewed only after the API reported it spent. Every
 *   partial write carries `expected_revision`; a stale one writes nothing and
 *   waits for an explicit "Save my changes".
 * - OG6b shows only after the backend recorded completion in this session;
 *   "Go to gym" records the Gym context (SF-84) and asks the entry, which
 *   opens `gym_home`.
 *
 * The OnboardingGate of the onboarding shell has already sent anyone with an
 * incomplete account registration to O04, carrying the Gym intent.
 */

export function GymOnboardingScreen() {
  const t = useTranslations("gymOnboarding");
  const draft = useGymDraft();
  const gymId = draft.data?.draftId ?? null;
  const setup = useGymSetup(gymId);
  const outcome = setup.isError ? outcomeOf(setup.error) : undefined;

  // Which draft to show is decided on a fresh read (a cached lookup from an
  // earlier visit may be outdated). The setup itself is re-read in place: a
  // refetch must never unmount the form and lose what is being typed, and a
  // newer setup (completed or discarded elsewhere) is reconciled by the flow.
  const settling = !draft.isFetchedAfterMount && draft.isFetching;
  const ready = draft.isSuccess && (gymId === null || setup.data !== undefined) && !settling;

  if (draft.isError || (setup.isError && outcome?.kind !== "gone")) {
    return (
      <Centered>
        <Notice tone="coral" icon={CircleAlert} live>
          {t("loadFailure")}
        </Notice>
        <Button
          label={t("retry")}
          variant="quiet"
          onPress={() => void (draft.isError ? draft.refetch() : setup.refetch())}
        />
      </Centered>
    );
  }
  if (outcome?.kind === "gone") {
    return (
      <Centered>
        <Notice tone="amber" icon={CircleAlert} live>
          {`${t("notices.gone.title")} ${t("notices.gone.body")}`}
        </Notice>
        <Button
          label={t("notices.gone.restart")}
          variant="quiet"
          onPress={() => void draft.refetch()}
        />
      </Centered>
    );
  }
  if (!ready) {
    return (
      <Centered>
        <Spinner label={t("loading")} />
      </Centered>
    );
  }
  return (
    // One Flow across the draft's creation: its edits, notice and pending
    // writes must survive the moment the new draft's id arrives.
    <Flow
      setup={gymId === null ? null : (setup.data ?? null)}
      completedGyms={draft.data?.completed ?? 0}
      onRestart={() => void draft.refetch()}
    />
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <View className="flex-1 justify-center gap-3 bg-background px-5">{children}</View>;
}

/** Each step's fields, in reading order (the first invalid one takes focus). */
const STEP_FIELDS: Record<FormStep, readonly SetupField[]> = {
  type: ["name", "gym_type", "phone", "website"],
  location: ["country_code", "city", "address_line", "entrance_note"],
  branding: ["accent_color", "tagline"],
};
const FORM_STEPS: readonly FormStep[] = ["type", "location", "branding"];

type Retry = "advance" | "finish" | "skip" | "exit";
type Opening = "idle" | "opening" | "failed";

/** The entry with the Gym intent: the gym's home once completed, otherwise the Gym journey. */
const gymEntry = (continuation: Continuation) =>
  routeHref("mobile.root", {}, continuationQuery({ ...continuation, intent: "gym" }));

const valuesOf = (setup: GymSetup | null): SetupValues =>
  setup === null
    ? {
        ...gymFrom(null),
        country_code: null,
        city: "",
        address_line: "",
        entrance_note: "",
        tagline: "",
        accent_color: null,
      }
    : { ...gymFrom(setup), ...locationFrom(setup), ...brandFrom(setup) };

function Flow({
  setup: queried,
  completedGyms,
  onRestart,
}: {
  setup: GymSetup | null;
  completedGyms: number;
  onRestart: () => void;
}) {
  const t = useTranslations("gymOnboarding");
  const router = useRouter();
  const params = useLocalSearchParams<{ step?: string }>();
  const [continuation] = useState(() => continuationOf(params));
  const { create, save, setLocation, complete, reload } = useGymSetupActions();
  const [edits, setEdits] = useState<Partial<SetupValues>>({});
  const [errors, setErrors] = useState<SetupErrors>({});
  const [focus, setFocus] = useState<{ field: SetupField }>();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [problem, setProblem] = useState<StepProblem>();
  const [retry, setRetry] = useState<Retry>("advance");
  const [justCompleted, setJustCompleted] = useState(false);
  const [opening, setOpening] = useState<Opening>("idle");
  // The create key of the attempt in progress: repeated by every retry of it
  // (a lost answer never makes a second gym), renewed only once spent.
  const createKey = useRef<string | undefined>(undefined);
  const scroll = useRef<ScrollView>(null);
  const revealTop = useCallback(() => scroll.current?.scrollTo({ y: 0, animated: true }), []);

  // A write's answer, used until the query delivers it (its observers are
  // notified a tick later), and only while the query still holds the setup
  // it was written over.
  const [written, setWritten] = useState<{ setup: GymSetup; over: GymSetup | null }>();
  const setup = written?.over === queried ? written.setup : queried;

  const values: SetupValues = { ...valuesOf(setup), ...edits };
  const decision = decideStep(setup, params.step ?? null, justCompleted);
  const step: Step = decision.kind === "step" ? decision.step : "type";

  // Keep the URL on the step actually shown.
  useEffect(() => {
    if (decision.kind === "step" && params.step !== decision.step) {
      router.setParams({ step: decision.step });
    }
  }, [decision, params.step, router]);

  const go = useCallback(
    (to: Step) => {
      setErrors({});
      setProblem(undefined);
      router.setParams({ step: to });
    },
    [router],
  );

  const change = useCallback(<K extends SetupField>(field: K, value: SetupValues[K]) => {
    setEdits((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const edited = (fields: readonly SetupField[]) => fields.filter((field) => field in edits);
  const settle = (next: GymSetup, saved: readonly SetupField[]) => {
    setWritten({ setup: next, over: queried });
    setEdits((current) => {
      const rest = { ...current };
      for (const field of saved) delete rest[field];
      return rest;
    });
  };

  function reject(found: Partial<Record<string, FieldMessage>>, fields: readonly SetupField[]) {
    const next: SetupErrors = {};
    for (const field of fields) if (found[field] !== undefined) next[field] = found[field];
    setErrors(next);
    const first = fields.find((field) => next[field] !== undefined);
    setFocus(first === undefined ? undefined : { field: first });
    return first !== undefined;
  }

  /** A failed call, as the notice to show; re-reads the setup when it changed elsewhere. */
  async function fail(error: unknown, action: StepAction, fields: readonly SetupField[]) {
    const outcome = outcomeOf(error);
    switch (outcome.kind) {
      case "invalid": {
        if (outcome.accountRegistration) {
          // Account registration (SF-44) first: the entry sends the person to O04, Gym intent kept.
          router.replace(gymEntry(continuation));
          return;
        }
        if (action === "finish" && outcome.missing.length > 0) {
          const target = outcome.missing
            .map((requirement) => REQUIREMENT_STEP[requirement])
            .sort((a, b) => FORM_STEPS.indexOf(a) - FORM_STEPS.indexOf(b))[0];
          setProblem({ kind: "rejected", missing: outcome.missing, step: target ?? "location" });
          return;
        }
        reject(outcome.fields, fields);
        setProblem({ kind: "invalid" });
        return;
      }
      case "stale":
      case "completed":
        if (setup !== null) {
          try {
            await reload(setup.gym_id);
          } catch {
            // The notice still applies; Retry or the foreground re-reads.
          }
        }
        setProblem(outcome.kind === "stale" ? { kind: "stale" } : undefined);
        return;
      case "unconfirmed":
        setProblem({ kind: "unconfirmed", action });
        return;
      case "rateLimited":
        setProblem({
          kind: "rateLimited",
          minutes:
            outcome.retryAfter === null ? null : Math.max(1, Math.ceil(outcome.retryAfter / 60)),
        });
        return;
      default:
        setProblem(outcome);
    }
  }

  /** OG1: creates the draft, or saves what changed; `true` once the API kept it. */
  async function saveType(leaving: boolean): Promise<boolean> {
    const fields = STEP_FIELDS.type;
    if (setup === null) {
      if (leaving && edited(fields).length === 0) return true;
      if (reject(gymErrors(values), fields)) {
        setProblem({ kind: "invalid" });
        return false;
      }
      const patch = gymPatch(values);
      let created: GymSetup;
      try {
        createKey.current ??= randomUUID();
        created = await create({
          client_request_id: createKey.current,
          name: patch.name as string,
          gym_type: values.gym_type as NonNullable<SetupValues["gym_type"]>,
        });
      } catch (error) {
        const outcome = outcomeOf(error);
        // A spent key: the next explicit Continue starts a new attempt.
        if (outcome.kind === "discarded" || outcome.kind === "reused")
          createKey.current = undefined;
        await fail(error, "create", fields);
        return false;
      }
      createKey.current = undefined;
      // The API resumed the draft this account already had: its saved values
      // load, the visitor's input stays, nothing more is written now.
      if (created.name !== patch.name || created.gym_type !== values.gym_type) {
        setWritten({ setup: created, over: queried });
        setProblem({ kind: "resumed" });
        return false;
      }
      const extra: GymSetupPatch = {
        ...(patch.phone !== null ? { phone: patch.phone } : {}),
        ...(patch.website !== null ? { website: patch.website } : {}),
      };
      if (Object.keys(extra).length === 0) {
        settle(created, fields);
        return true;
      }
      // The gym exists now: name and type are saved; a failed first save
      // keeps phone and website edited for Retry against the new draft.
      settle(created, ["name", "gym_type"]);
      try {
        settle(await save(created, extra), fields);
        return true;
      } catch (error) {
        await fail(error, "save", fields);
        return false;
      }
    }
    const changed = edited(fields);
    if (changed.length === 0) return true;
    if (reject(gymErrors(values), fields)) {
      setProblem({ kind: "invalid" });
      return false;
    }
    const all = gymPatch(values) as Record<string, unknown>;
    const patch = Object.fromEntries(
      changed.filter((field) => field in all).map((field) => [field, all[field]]),
    );
    try {
      settle(await save(setup, patch as GymSetupPatch), changed);
      return true;
    } catch (error) {
      await fail(error, "save", fields);
      return false;
    }
  }

  /** OG2: writes the whole location when it changed; Continue needs one. */
  async function saveLocation(leaving: boolean): Promise<boolean> {
    if (setup === null) return true;
    const fields = STEP_FIELDS.location;
    // Nothing typed: leaving keeps what is saved; Continue needs a location.
    if (edited(fields).length === 0 && (leaving || setup.primary_location !== null)) return true;
    if (reject(locationErrors(values), fields)) {
      setProblem({ kind: "invalid" });
      return false;
    }
    if (!locationChanged(setup, values)) {
      settle(setup, fields);
      return true;
    }
    try {
      settle(await setLocation(setup, locationInput(values)), fields);
      return true;
    } catch (error) {
      await fail(error, "save", fields);
      return false;
    }
  }

  /** OG3: saves the branding that changed. */
  async function saveBranding(): Promise<boolean> {
    if (setup === null) return true;
    const fields = STEP_FIELDS.branding;
    const changed = edited(fields);
    if (changed.length === 0) return true;
    if (reject(brandErrors(values), fields)) {
      setProblem({ kind: "invalid" });
      return false;
    }
    const all = brandPatch(values) as Record<string, unknown>;
    const patch = Object.fromEntries(changed.map((field) => [field, all[field]]));
    try {
      settle(await save(setup, patch as GymSetupPatch), changed);
      return true;
    } catch (error) {
      await fail(error, "save", fields);
      return false;
    }
  }

  const saveStep = (formStep: FormStep, leaving = false) =>
    formStep === "type"
      ? saveType(leaving)
      : formStep === "location"
        ? saveLocation(leaving)
        : saveBranding();

  /** One action at a time: a second tap while one runs does nothing. */
  async function run(kind: Retry, action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    Keyboard.dismiss();
    setRetry(kind);
    setProblem(undefined);
    setBusy(true);
    try {
      await action();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function finish(current: GymSetup) {
    // Set first: the completed setup reaches the cache before `complete()`
    // resolves, and must render as OG6b, not as an exit. OG6b still needs the
    // backend's `completed`, so it never shows unless completion happened.
    setJustCompleted(true);
    try {
      setWritten({ setup: await complete(current), over: queried });
      go("complete");
    } catch (error) {
      setJustCompleted(false);
      await fail(error, "finish", STEP_FIELDS.branding);
    }
  }

  const advance = () =>
    run("advance", async () => {
      if (step === "complete") return;
      if (!(await saveStep(step))) return;
      if (step === "branding") {
        if (setup !== null) await finish(setup);
      } else {
        go(step === "type" ? "location" : "branding");
      }
    });

  // Skip: the branding edits are left out, by the visitor's choice; what was
  // saved before stays.
  const skip = () =>
    run("skip", async () => {
      if (setup === null) return;
      setEdits((current) => {
        const rest = { ...current };
        delete rest.tagline;
        delete rest.accent_color;
        return rest;
      });
      setErrors({});
      await finish(setup);
    });

  /**
   * Save & exit: every step's unsaved edits are saved first (never completes,
   * never discards). Then back to the person's other context through the
   * entry; with only this draft that would reopen it, so Settings (with Sign
   * out) is the way out instead.
   */
  const exit = () =>
    run("exit", async () => {
      for (const formStep of FORM_STEPS) {
        if (!(await saveStep(formStep, true))) {
          if (formStep !== step) go(formStep);
          return;
        }
      }
      try {
        const entry = await fetchEntry({});
        if (isKnownEntry(entry) && entry.destination !== "gym_onboarding") {
          router.replace(entryHref(entry));
          return;
        }
      } catch {
        // The entry could not be asked: Settings is always a valid place.
      }
      router.replace(routeHref("mobile.settings"));
    });

  const retryLast = () => {
    if (retry === "skip") void skip();
    else if (retry === "exit") void exit();
    else void advance();
  };

  const back = () => {
    if (step === "complete") return;
    if (step === "branding") go("location");
    else if (step === "location") go("type");
    else if (router.canGoBack()) router.back();
    else router.replace(withContinuation("mobile.onboarding.role", continuation));
  };

  const openGym = async () => {
    if (opening === "opening" || setup === null) return;
    setOpening("opening");
    try {
      await chooseEntryContext("gym", setup.gym_id);
      router.replace(gymEntry(continuation));
    } catch {
      // The gym stays completed; the person can try again.
      setOpening("failed");
    }
  };

  // Android's back button walks the steps like the header's Back; on OG6b
  // (completion is final) it continues through the entry with the Gym intent.
  const latestBack = useRef(back);
  useEffect(() => {
    latestBack.current = back;
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step === "type") return false;
      if (step === "complete") router.replace(gymEntry(continuation));
      else latestBack.current();
      return true;
    });
    return () => subscription.remove();
  }, [continuation, router, step]);

  const gymName = values.name.trim() === "" ? t("newGym") : values.name.trim();

  if (decision.kind === "exit") return <Redirect href={gymEntry(continuation)} />;

  return (
    <>
      {/* The steps share one screen: iOS swipe-back would leave the whole
          flow, so it is offered only on OG1, where Back leaves it too. */}
      <Stack.Screen options={{ gestureEnabled: step === "type" }} />
      <StepFrame
        scroll={scroll}
        step={step}
        busy={busy}
        title={
          step === "complete" ? t("done.title", { name: setup?.name ?? "" }) : t(`titles.${step}`)
        }
        onBack={step === "complete" ? undefined : back}
        onSaveExit={step === "complete" ? undefined : () => void exit()}
        actions={
          step === "complete" ? (
            <Button
              label={t(opening === "failed" ? "done.retry" : "done.continue")}
              size="lg"
              loading={opening === "opening"}
              onPress={() => void openGym()}
            />
          ) : (
            <>
              <Button
                label={step === "branding" ? t("branding.create") : t("continue")}
                size="lg"
                loading={busy && retry !== "skip" && retry !== "exit"}
                disabled={busy}
                onPress={() => void advance()}
              />
              {step === "branding" && (
                <Button
                  label={t("branding.skip")}
                  variant="quiet"
                  size="lg"
                  loading={busy && retry === "skip"}
                  disabled={busy}
                  onPress={() => void skip()}
                />
              )}
            </>
          )
        }
      >
        <>
          {problem && (
            <StepNotice
              problem={problem}
              onRetry={retryLast}
              onGoTo={(to) => go(to)}
              onRestart={onRestart}
            />
          )}
          {step === "type" && (
            <TypeStep
              values={values}
              errors={errors}
              disabled={busy}
              onChange={change}
              focus={focus}
              onRevealTop={revealTop}
              anotherGym={setup === null && completedGyms > 0}
            />
          )}
          {step === "location" && (
            <LocationStep
              values={values}
              errors={errors}
              disabled={busy}
              onChange={change}
              focus={focus}
              onRevealTop={revealTop}
            />
          )}
          {step === "branding" && (
            <BrandingStep
              values={values}
              errors={errors}
              disabled={busy}
              onChange={change}
              focus={focus}
              onRevealTop={revealTop}
              gymName={gymName}
            />
          )}
          {step === "complete" && <CreatedStep />}
          {step === "complete" && opening === "failed" && (
            <Notice tone="amber" icon={CircleAlert} live>
              {t("done.failureBody")}
            </Notice>
          )}
        </>
      </StepFrame>
    </>
  );
}

/**
 * The OG1–OG3 and OG6b frame (the approved mobile onboarding frame, COACH 3):
 * a 44 pt back button, "STEP n OF 3 · SECTION" (OG6b: "GYM · CREATED", no
 * back) and Save & exit, the three-segment progress bar, the heading and
 * line, the scrolling body on 20 pt gutters and the actions pinned above the
 * home indicator. Insets are runtime values (the only `style`).
 */
function StepFrame({
  scroll,
  step,
  busy,
  title,
  onBack,
  onSaveExit,
  actions,
  children,
}: {
  scroll: RefObject<ScrollView | null>;
  step: Step;
  busy: boolean;
  title: string;
  onBack?: (() => void) | undefined;
  onSaveExit?: (() => void) | undefined;
  actions: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("gymOnboarding");
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
  // into the visible part. Android resizes and scrolls by itself.
  const offset = useRef(0);
  const viewport = useRef(0);
  const reveal = useCallback(() => {
    if (Platform.OS !== "ios") return;
    const input = TextInput.State.currentlyFocusedInput();
    const container = content.current;
    if (!input || !container) return;
    input.measureLayout(container, (_x, y, _width, height) => {
      const bottom = y + height + 48;
      if (bottom > offset.current + viewport.current || y < offset.current) {
        scroll.current?.scrollTo({ y: Math.max(0, bottom - viewport.current), animated: true });
      }
    });
  }, [scroll]);
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
                    : t("stepLabel", { step: position, total, section: t(`sections.${step}`) })}
                </Text>
                {onSaveExit ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={onSaveExit}
                    hitSlop={8}
                    className="min-h-11 justify-center"
                  >
                    <Text variant="caption" weight="extrabold" color="mutedForeground">
                      {t("saveExit")}
                    </Text>
                  </Pressable>
                ) : null}
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
              <View className="size-16 items-center justify-center rounded-3xl bg-primary">
                <Icon icon={Check} size={32} color="primaryForeground" />
              </View>
            )}
            <View className="gap-2">
              <Text variant="h1" accessibilityRole="header">
                {title}
              </Text>
              <Text color="mutedForeground">{t(`descriptions.${step}`)}</Text>
            </View>
            <FieldFocus.Provider value={revealSoon}>{children}</FieldFocus.Provider>
          </View>
        </ScrollView>
        <View
          className="gap-2.5 px-5 pt-3"
          // Runtime inset: the action sits 34 pt above the bottom edge on the artboards.
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          {actions}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
