import {
  CalendarDays,
  CircleAlert,
  Clock,
  Globe,
  TriangleAlert,
  UserRound,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Pressable, View } from "react-native";
import { useFormatter, useLocale, useTimeZone, useTranslations } from "use-intl";

import { isUnavailable, useCoachFighters, type CoachFighter } from "@/entities/coach-fighter";
import {
  fighterLabel,
  TRAINING_TYPES,
  type CoachTrainingSession,
  type TrainingType,
} from "@/entities/training-session";
import {
  formatOffset,
  pickerValue,
  plannableZone,
  selectableTimeZones,
  toRfc3339,
  wallTimeOf,
  zoneOffsetMinutes,
  type WallTimeResolution,
} from "@/shared/lib/time-zone";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Chip } from "@/shared/ui/chip";
import { FieldError } from "@/shared/ui/field-error";
import { Icon } from "@/shared/ui/icon";
import { Input } from "@/shared/ui/input";
import { Notice } from "@/shared/ui/notice";
import { Skeleton } from "@/shared/ui/skeleton";
import { Text } from "@/shared/ui/text";
import { Textarea } from "@/shared/ui/textarea";

import {
  changedFields,
  chosenInstant,
  createValues,
  DURATION,
  editValues,
  NOTES_MAX,
  resolutionOf,
  serverProblem,
  TITLE_MAX,
  type Problem,
  type SessionValues,
} from "../model/form";
import {
  matchesBody,
  useCreateTrainingSession,
  useRequestKey,
  useUpdateTrainingSession,
  type CreateBody,
} from "../model/save-session";
import { ChoiceSheet, ScheduleRow, useWallPicker, WallPickerSheet, type Choice } from "./pickers";

/*
 * CT2 New session and CT4 Edit session (Claude Design 1792504884-2e4e,
 * SessionControl.dc.html screen=create|edit, SF-65): one session for one
 * fighter of the coach's active relationships. The backend owns every rule;
 * the checks here only help (a title, a type, a start, 5–600 minutes) and
 * never round or change what the coach entered.
 */

/**
 * How a save ended. `earlier`: the answer to an earlier attempt was lost and
 * the coach changed the form meanwhile; the backend returned the session it
 * had stored then (same request key), which is not what the form now says.
 */
export type SaveOutcome = "created" | "earlier" | "updated" | "unchanged";

type Saved = (session: CoachTrainingSession, outcome: SaveOutcome) => void;

const DIGITS = /^\d+$/;

/**
 * A new training session (CT2), sent to `createMyCoachTrainingSession`
 * (SF-62) with one `client_request_id` per request body, reused on retry
 * (`useRequestKey`). The fighters are the coach's active relationships
 * (SF-56, every page); none is its own state, and planning not available
 * (`404`) is never shown as an empty roster.
 */
export function CreateTrainingSessionForm({
  onSaved,
  onFighters,
}: {
  onSaved: Saved;
  /** Opens the Fighters tab (no fighters yet). */
  onFighters: () => void;
}) {
  const t = useTranslations("coachSessions");
  const roster = useCoachFighters("active");
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = roster;

  // Every active relationship is a choice: read the remaining pages.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (roster.isError && isUnavailable(roster.error)) return <FormNotice problem="unavailable" />;
  if (roster.isError) {
    return (
      <View className="gap-3" testID="session-form:roster-failed">
        <View accessibilityRole="alert">
          <Notice tone="coral" icon={CircleAlert}>
            {`${t("failed.title")} ${t("failed.body")}`}
          </Notice>
        </View>
        <Button label={t("failed.retry")} variant="quiet" onPress={() => void roster.refetch()} />
      </View>
    );
  }
  if (roster.data === undefined || roster.hasNextPage) return <FormSkeleton />;

  const fighters = roster.data.pages.flatMap((page) => page.relationships);
  if (fighters.length === 0) {
    return (
      <View
        accessible
        accessibilityRole="summary"
        className="items-start gap-2.5 rounded-3xl border border-border bg-surface p-5"
        testID="session-form:no-fighters"
      >
        <View className="size-11 items-center justify-center rounded-2xl bg-accent">
          <Icon icon={UserRound} color="highlight" />
        </View>
        <Text variant="h3">{t("form.noFighters.title")}</Text>
        <Text color="mutedForeground">{t("form.noFighters.body")}</Text>
        <Button label={t("form.noFighters.action")} variant="quiet" onPress={onFighters} />
      </View>
    );
  }
  return <SessionFields mode={{ kind: "create", fighters }} onSaved={onSaved} />;
}

/**
 * The form of a planned session (CT4): its values, the fighter fixed; only
 * the fields the coach changed are sent to `updateMyCoachTrainingSession`,
 * so a change made meanwhile elsewhere is not written back. A session that
 * is no longer planned gets no form.
 */
export function EditTrainingSessionForm({
  session,
  onSaved,
}: {
  session: CoachTrainingSession;
  onSaved: Saved;
}) {
  if (session.status !== "planned") return <FormNotice problem="conflict" />;
  return <SessionFields mode={{ kind: "edit", session }} onSaved={onSaved} />;
}

type Mode =
  { kind: "create"; fighters: CoachFighter[] } | { kind: "edit"; session: CoachTrainingSession };

/** Whether `locale` writes times with a day period (12-hour). */
const twelveHour = (locale: string) =>
  new Intl.DateTimeFormat(locale, { hour: "numeric" })
    .formatToParts(new Date(0))
    .some((part) => part.type === "dayPeriod");

function SessionFields({ mode, onSaved }: { mode: Mode; onSaved: Saved }) {
  const t = useTranslations("coachSessions");
  const format = useFormatter();
  const locale = useLocale();
  const deviceZone = plannableZone(useTimeZone());
  const editing = mode.kind === "edit";
  const [initial] = useState(() =>
    mode.kind === "edit"
      ? editValues(mode.session)
      : createValues(
          mode.fighters.length === 1 ? (mode.fighters[0]?.relationship_id ?? "") : "",
          deviceZone ?? "UTC",
        ),
  );
  const form = useForm<SessionValues>({ defaultValues: initial, mode: "onTouched" });
  const { errors } = form.formState;
  const [problem, setProblem] = useState<Problem | null>(null);
  const [earlier, setEarlier] = useState<CoachTrainingSession | null>(null);
  const [sheet, setSheet] = useState<"fighter" | "zone" | null>(null);
  const requestKey = useRequestKey();
  const create = useCreateTrainingSession();
  const update = useUpdateTrainingSession(editing ? mode.session.id : "");
  const pending = create.isPending || update.isPending;

  const [relationshipId, date, time, timeZone, occurrence] = useWatch({
    control: form.control,
    name: ["relationshipId", "date", "time", "timeZone", "occurrence"],
  });
  const resolution = useMemo(() => resolutionOf({ date, time, timeZone }), [date, time, timeZone]);

  // A new wall time drops an earlier choice between two repeated instants.
  useEffect(() => {
    if (resolution.kind !== "overlap" && form.getValues("occurrence") !== "")
      form.setValue("occurrence", "");
  }, [resolution.kind, form]);

  // A fighter whose relationship ended while the form was open is no choice.
  const fighters = mode.kind === "create" ? mode.fighters : [];
  const goneFighter =
    mode.kind === "create" &&
    relationshipId !== "" &&
    !fighters.some((fighter) => fighter.relationship_id === relationshipId);
  useEffect(() => {
    if (goneFighter) form.setValue("relationshipId", "");
  }, [goneFighter, form]);

  const now = new Date();
  const zoneForPicker = timeZone || "UTC";
  const today = wallTimeOf(now, zoneForPicker);
  const nextHour = wallTimeOf(
    new Date(Math.ceil(now.getTime() / 3_600_000) * 3_600_000),
    zoneForPicker,
  );
  const picker = useWallPicker({
    date,
    time,
    fallback: { date: today.date, time: nextHour.time },
    minimumDate: wallTimeOf(new Date(now.getTime() - 86_400_000), zoneForPicker).date,
    maximumDate: wallTimeOf(new Date(now.getTime() + 365 * 86_400_000), zoneForPicker).date,
    is24Hour: !twelveHour(locale),
    onPick: (mode, picked) =>
      mode === "time"
        ? form.setValue("time", picked.time, { shouldValidate: true })
        : form.setValue("date", picked.date, { shouldValidate: true }),
  });

  const fighterChoices: Choice[] = fighters.map((fighter) => ({
    value: fighter.relationship_id,
    label: rosterLabel(fighter) ?? t("form.fighter.notShared"),
    description: t("form.fighter.since", {
      date: format.dateTime(new Date(fighter.started_at), "date"),
    }),
  }));
  const chosenFighter = fighters.find((fighter) => fighter.relationship_id === relationshipId);
  const fighterName =
    mode.kind === "edit"
      ? (sessionFighter(mode.session) ?? t("planner.fighterNotShared"))
      : chosenFighter
        ? (rosterLabel(chosenFighter) ?? t("form.fighter.notShared"))
        : null;

  const zones = useMemo(() => {
    const all = selectableTimeZones([initial.timeZone]);
    const first = [initial.timeZone, deviceZone].filter(
      (zone, index, list): zone is string => !!zone && list.indexOf(zone) === index,
    );
    return [...first, ...all.filter((zone) => !first.includes(zone))].map((zone) => ({
      value: zone,
      label: zone,
    }));
  }, [initial.timeZone, deviceZone]);
  const at = chosenInstant(resolution, occurrence);
  const offsetAt = at?.instant ?? (resolution.kind === "overlap" ? resolution.first.instant : now);
  const describeZone = (zone: string) => {
    const offset = `UTC${formatOffset(zoneOffsetMinutes(zone, offsetAt))}`;
    return zone === deviceZone ? t("form.zone.device", { offset }) : offset;
  };

  const dateLabel = date
    ? format.dateTime(pickerValue(date, "12:00"), {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;
  const timeLabel = time
    ? format.dateTime(pickerValue("2000-01-01", time), {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : null;

  const messages = {
    fighter: t("form.fighter.required"),
    title: t("form.title.invalid"),
    type: t("form.type.required"),
    startWindow: t("form.time.window"),
    startInvalid: t("form.time.invalid"),
    zone: t("form.zone.invalid"),
    duration: t("form.duration.invalid"),
    notes: t("form.notes.invalid"),
  };

  const submit = form.handleSubmit((values) => {
    setProblem(null);
    setEarlier(null);
    if (resolution.kind === "gap") return;
    if (resolution.kind === "invalid") {
      form.setError("time", { message: t("form.time.invalid") });
      return;
    }
    const chosen = chosenInstant(resolution, values.occurrence);
    if (chosen === null) {
      form.setError("occurrence", { message: t("form.overlap.required") });
      return;
    }

    const notes = values.notes.trim();
    const failed = (failure: unknown) => {
      const outcome = serverProblem(failure, form.setError, messages);
      setProblem(outcome);
      return outcome;
    };

    if (mode.kind === "create") {
      const body: CreateBody = {
        relationship_id: values.relationshipId,
        title: values.title.trim(),
        training_type: values.trainingType as TrainingType,
        starts_at: toRfc3339(chosen),
        time_zone: values.timeZone,
        duration_minutes: Number(values.duration),
        ...(notes === "" ? {} : { notes }),
      };
      const uncertain = requestKey.uncertain;
      create.mutate(
        { body, key: requestKey.for(body) },
        {
          onSuccess: (session) => {
            requestKey.reset();
            // The same key after a lost answer returns what was stored then.
            if (uncertain && !matchesBody(session, body)) setEarlier(session);
            else onSaved(session, "created");
          },
          onError: (failure) => {
            requestKey.settle(failure);
            // The key named a session stored earlier for another fighter.
            if (failed(failure) === "reused") requestKey.reset();
          },
        },
      );
      return;
    }

    const changes = changedFields(mode.session, values, chosen);
    if (Object.keys(changes).length === 0) return onSaved(mode.session, "unchanged");
    update.mutate(changes, {
      onSuccess: (session) => onSaved(session, "updated"),
      onError: (failure) => void failed(failure),
    });
  });

  const error = (field: keyof SessionValues) => errors[field]?.message;

  return (
    <View className="gap-4" testID={`session-form:${mode.kind}`}>
      <Controller
        control={form.control}
        name="relationshipId"
        rules={{ required: t("form.fighter.required") }}
        render={() => (
          <View className="gap-1.5">
            <Text variant="caption" weight="bold" color="mutedForeground">
              {t("form.fighter.label")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t("form.fighter.label")}, ${fighterName ?? t("form.fighter.placeholder")}`}
              accessibilityHint={editing ? t("form.fighter.fixed") : t("form.fighter.open")}
              accessibilityState={{ disabled: editing || pending }}
              disabled={editing || pending}
              onPress={() => setSheet("fighter")}
              className={`min-h-14 flex-row items-center gap-3 rounded-lg bg-surface px-3.5 ${errors.relationshipId ? "border-2 border-destructive" : "border border-border"}`}
            >
              {fighterName === null ? (
                <Icon icon={UserRound} color="faintForeground" />
              ) : (
                <Avatar name={fighterName} size="sm" />
              )}
              <Text
                variant="body"
                weight="extrabold"
                color={fighterName === null ? "faintForeground" : "foreground"}
                className="flex-1"
                numberOfLines={1}
              >
                {fighterName ?? t("form.fighter.placeholder")}
              </Text>
            </Pressable>
            {error("relationshipId") ? (
              <FieldError message={error("relationshipId") ?? ""} />
            ) : (
              <Text variant="caption" color="faintForeground">
                {editing ? t("form.fighter.fixed") : t("form.fighter.hint")}
              </Text>
            )}
          </View>
        )}
      />

      <Controller
        control={form.control}
        name="title"
        rules={{
          validate: (value) =>
            (value.trim().length > 0 && value.trim().length <= TITLE_MAX) ||
            t("form.title.invalid"),
        }}
        render={({ field }) => (
          <Input
            label={t("form.title.label")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            maxLength={TITLE_MAX}
            editable={!pending}
            returnKeyType="next"
            error={error("title")}
          />
        )}
      />

      <Controller
        control={form.control}
        name="trainingType"
        rules={{ required: t("form.type.required") }}
        render={({ field }) => (
          <View className="gap-1.5">
            <Text variant="caption" weight="bold" color="mutedForeground">
              {t("form.type.label")}
            </Text>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t("form.type.label")}
              className="flex-row flex-wrap gap-2"
            >
              {TRAINING_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={t(`types.${type}`)}
                  checked={field.value === type}
                  disabled={pending}
                  onPress={() => field.onChange(type)}
                />
              ))}
            </View>
            {error("trainingType") ? <FieldError message={error("trainingType") ?? ""} /> : null}
          </View>
        )}
      />

      <View className="gap-1.5">
        <View className="rounded-3xl border border-border bg-surface px-3.5">
          <Controller
            control={form.control}
            name="date"
            rules={{ required: t("form.date.required") }}
            render={() => (
              <ScheduleRow
                label={t("form.date.label")}
                value={dateLabel}
                placeholder={t("form.date.placeholder")}
                hint={t("form.date.open")}
                icon={CalendarDays}
                invalid={errors.date !== undefined}
                disabled={pending}
                onPress={() => picker.show("date")}
              />
            )}
          />
          <Controller
            control={form.control}
            name="time"
            rules={{ required: t("form.time.required") }}
            render={() => (
              <ScheduleRow
                label={t("form.time.label")}
                value={timeLabel}
                placeholder={t("form.time.placeholder")}
                hint={t("form.time.open")}
                icon={Clock}
                invalid={errors.time !== undefined || resolution.kind === "gap"}
                disabled={pending}
                onPress={() => picker.show("time")}
              />
            )}
          />
          <ScheduleRow
            label={t("form.zone.label")}
            value={timeZone}
            placeholder={t("form.zone.label")}
            hint={t("form.zone.open")}
            icon={Globe}
            invalid={errors.timeZone !== undefined}
            disabled={pending}
            last
            onPress={() => setSheet("zone")}
          />
        </View>
        {error("date") ? <FieldError message={error("date") ?? ""} /> : null}
        {error("time") ? <FieldError message={error("time") ?? ""} /> : null}
        {error("timeZone") ? <FieldError message={error("timeZone") ?? ""} /> : null}
        <Text variant="caption" color="faintForeground">
          {t("form.zone.hint")}
        </Text>
      </View>

      {resolution.kind === "gap" ? (
        <View accessibilityRole="alert" testID="session-form:gap">
          <Notice tone="amber" icon={TriangleAlert}>
            {`${t("form.gap.title")} ${t("form.gap.body", { zone: timeZone })}`}
          </Notice>
        </View>
      ) : null}
      {resolution.kind === "overlap" ? (
        <Overlap
          resolution={resolution}
          zone={timeZone}
          time={timeLabel ?? time}
          value={occurrence}
          error={error("occurrence")}
          disabled={pending}
          onChange={(next) => {
            form.setValue("occurrence", next);
            form.clearErrors("occurrence");
          }}
        />
      ) : null}

      <Controller
        control={form.control}
        name="duration"
        rules={{
          validate: (value) =>
            (DIGITS.test(value.trim()) &&
              Number(value) >= DURATION.min &&
              Number(value) <= DURATION.max) ||
            t("form.duration.invalid"),
        }}
        render={({ field }) => (
          <Input
            label={t("form.duration.label")}
            description={t("form.duration.hint")}
            unit={t("form.duration.unit")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            keyboardType="number-pad"
            maxLength={3}
            editable={!pending}
            error={error("duration")}
          />
        )}
      />

      <Controller
        control={form.control}
        name="notes"
        rules={{
          validate: (value) => value.trim().length <= NOTES_MAX || t("form.notes.invalid"),
        }}
        render={({ field }) => (
          <Textarea
            label={t("form.notes.label")}
            description={t("form.notes.hint")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            maxLength={NOTES_MAX}
            editable={!pending}
            error={error("notes")}
          />
        )}
      />

      {earlier !== null ? (
        <View className="gap-2.5" testID="session-form:earlier">
          <View accessibilityRole="alert">
            <Notice tone="amber" icon={TriangleAlert}>
              {`${t("form.notices.earlier.title")} ${t("form.notices.earlier.body", { title: earlier.title })}`}
            </Notice>
          </View>
          <Button
            label={t("form.notices.earlierOpen")}
            variant="quiet"
            onPress={() => onSaved(earlier, "earlier")}
          />
        </View>
      ) : null}
      {problem !== null ? <FormNotice problem={problem} mode={mode.kind} /> : null}

      <Button
        label={pending ? t("form.saving") : editing ? t("form.save") : t("form.create")}
        size="lg"
        loading={pending}
        disabled={pending || resolution.kind === "gap"}
        onPress={() => void submit()}
        testID="session-form:submit"
      />

      <ChoiceSheet
        visible={sheet === "fighter"}
        title={t("form.fighter.choose")}
        description={t("form.fighter.hint")}
        searchLabel={t("form.fighter.search")}
        emptyLabel={t("form.fighter.empty")}
        moreLabel={t("form.more")}
        closeLabel={t("form.close")}
        choices={fighterChoices}
        value={relationshipId}
        onChoose={(value) => {
          form.setValue("relationshipId", value, { shouldValidate: true });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <ChoiceSheet
        visible={sheet === "zone"}
        title={t("form.zone.label")}
        searchLabel={t("form.zone.search")}
        emptyLabel={t("form.zone.empty")}
        moreLabel={t("form.more")}
        closeLabel={t("form.close")}
        choices={zones}
        value={timeZone}
        describe={describeZone}
        onChoose={(value) => {
          form.setValue("timeZone", value, { shouldValidate: true });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <WallPickerSheet
        mode={picker.open}
        value={picker.value}
        bounds={picker.bounds}
        title={picker.open === "time" ? t("form.time.label") : t("form.date.label")}
        doneLabel={t("form.done")}
        locale={locale}
        onPick={picker.pick}
        onClose={picker.close}
      />
    </View>
  );
}

function Overlap({
  resolution,
  zone,
  time,
  value,
  error,
  disabled,
  onChange,
}: {
  resolution: Extract<WallTimeResolution, { kind: "overlap" }>;
  zone: string;
  time: string;
  value: SessionValues["occurrence"];
  error: string | undefined;
  disabled: boolean;
  onChange: (value: "first" | "second") => void;
}) {
  const t = useTranslations("coachSessions.form.overlap");
  const options = [
    ["first", resolution.first.offsetMinutes],
    ["second", resolution.second.offsetMinutes],
  ] as const;
  return (
    <View
      className="gap-2.5 rounded-lg border border-warning-border bg-warning-subtle px-3.5 py-3"
      testID="session-form:overlap"
    >
      <Text variant="bodySm" weight="extrabold" color="warningSubtleForeground">
        {t("title")}
      </Text>
      <Text variant="caption" color="warningSubtleForeground">
        {t("body", { zone, time })}
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t("title")}
        className="flex-row flex-wrap gap-2"
      >
        {options.map(([option, offset]) => (
          <Chip
            key={option}
            label={t(option, { offset: formatOffset(offset) })}
            checked={value === option}
            disabled={disabled}
            onPress={() => onChange(option)}
          />
        ))}
      </View>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

function FormNotice({ problem, mode = "create" }: { problem: Problem; mode?: Mode["kind"] }) {
  const t = useTranslations("coachSessions.form.notices");
  const tone = problem === "failed" ? "coral" : "amber";
  const body = problem === "failed" ? t(`failed.${mode}`) : t(`${problem}.body`);
  return (
    <View accessibilityRole="alert" testID={`session-form:problem:${problem}`}>
      <Notice tone={tone} icon={problem === "failed" ? CircleAlert : TriangleAlert}>
        {`${t(`${problem}.title`)} ${body}`}
      </Notice>
    </View>
  );
}

function FormSkeleton() {
  const t = useTranslations("coachSessions");
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("form.loading")}
      className="gap-4"
      testID="session-form:loading"
    >
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-14 rounded-lg" />
      ))}
    </View>
  );
}

/** A roster fighter: display name · @username, either alone, or `null` when neither is shared. */
function rosterLabel(relationship: CoachFighter): string | null {
  const { fighter } = relationship;
  const name = fighter?.display_name ?? null;
  const handle = fighter?.username ? `@${fighter.username}` : null;
  if (name && handle) return `${name} · ${handle}`;
  return name ?? handle;
}

function sessionFighter(session: CoachTrainingSession): string | null {
  const name = fighterLabel(session.fighter);
  const handle = session.fighter?.username ? `@${session.fighter.username}` : null;
  return name && handle && name !== handle ? `${name} · ${handle}` : name;
}
