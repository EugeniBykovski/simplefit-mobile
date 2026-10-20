import type { UseFormSetError } from "react-hook-form";

import type { CoachTrainingSession, TrainingType } from "@/entities/training-session";
import type { TrainingSessionUpdateRequest } from "@/shared/api/generated/model";
import { isApiError } from "@/shared/api/http/api-error";
import {
  resolveWallTime,
  toRfc3339,
  wallTimeOf,
  type WallInstant,
  type WallTimeResolution,
} from "@/shared/lib/time-zone";

/** The form's own input; only the backend's answer is ever shown as saved. */
export type SessionValues = {
  relationshipId: string;
  title: string;
  trainingType: TrainingType | "";
  /** The wall date in `timeZone`, `YYYY-MM-DD` ("" until chosen). */
  date: string;
  /** The wall time in `timeZone`, `HH:MM` ("" until chosen). */
  time: string;
  timeZone: string;
  duration: string;
  notes: string;
  /** Which of a repeated wall time's two instants (DST fall-back), when it is one. */
  occurrence: "" | "first" | "second";
};

/**
 * What a create or an edit ended with, when it is not a saved session:
 * - `failed`: nothing changed (offline, a server error, an unexpected answer);
 * - `conflict`: the session was completed or cancelled meanwhile (`409`);
 * - `unavailable`: the fighter or session can no longer be planned (`404`);
 * - `reused`: an earlier attempt whose answer was lost already stored a
 *   session for another fighter (`409 client_request_id: reused`).
 */
export type Problem = "failed" | "conflict" | "unavailable" | "reused";

export const TITLE_MAX = 80;
export const NOTES_MAX = 2000;
export const DURATION = { min: 5, max: 600 } as const;

export function createValues(relationshipId: string, timeZone: string): SessionValues {
  return {
    relationshipId,
    title: "",
    trainingType: "",
    date: "",
    time: "",
    timeZone,
    duration: "60",
    notes: "",
    occurrence: "",
  };
}

/** The values of a planned session: its start on the wall clock of its own zone. */
export function editValues(session: CoachTrainingSession): SessionValues {
  const start = new Date(session.starts_at);
  const wall = wallTimeOf(start, session.time_zone);
  const resolution = resolveWallTime(wall.date, wall.time, session.time_zone);
  return {
    relationshipId: session.relationship_id,
    title: session.title,
    trainingType: session.training_type,
    date: wall.date,
    time: wall.time,
    timeZone: session.time_zone,
    duration: String(session.duration_minutes),
    notes: session.notes ?? "",
    occurrence:
      resolution.kind === "overlap"
        ? resolution.first.instant.getTime() === start.getTime()
          ? "first"
          : "second"
        : "",
  };
}

export function resolutionOf(values: Pick<SessionValues, "date" | "time" | "timeZone">) {
  return values.date && values.time && values.timeZone
    ? resolveWallTime(values.date, values.time, values.timeZone)
    : ({ kind: "invalid" } as const);
}

/** The instant the form's schedule means, or `null` when there is none (yet). */
export function chosenInstant(
  resolution: WallTimeResolution,
  occurrence: SessionValues["occurrence"],
): WallInstant | null {
  if (resolution.kind === "exact") return resolution.at;
  if (resolution.kind === "overlap" && occurrence !== "")
    return occurrence === "first" ? resolution.first : resolution.second;
  return null;
}

/** The fields of `values` that differ from `session`, in the update body's shape. */
export function changedFields(
  session: CoachTrainingSession,
  values: SessionValues,
  at: WallInstant,
): TrainingSessionUpdateRequest {
  const changes: TrainingSessionUpdateRequest = {};
  const title = values.title.trim();
  if (title !== session.title) changes.title = title;
  if (values.trainingType !== session.training_type && values.trainingType !== "")
    changes.training_type = values.trainingType;
  const duration = Number(values.duration);
  if (duration !== session.duration_minutes) changes.duration_minutes = duration;
  const notes = values.notes.trim() === "" ? null : values.notes.trim();
  if (notes !== session.notes) changes.notes = notes;
  const zoneChanged = values.timeZone !== session.time_zone;
  if (zoneChanged || at.instant.getTime() !== new Date(session.starts_at).getTime()) {
    changes.starts_at = toRfc3339(at);
    // The offset must be the zone's: a changed zone travels with its start.
    if (zoneChanged) changes.time_zone = values.timeZone;
  }
  return changes;
}

type FieldMessages = {
  fighter: string;
  title: string;
  type: string;
  startWindow: string;
  startInvalid: string;
  zone: string;
  duration: string;
  notes: string;
};

/**
 * What the backend's refusal means for the form: field codes land on their
 * fields (translated, never the backend's English); `409` is a session that
 * can no longer change, or a request key already used for another fighter;
 * `404` a fighter or session the coach can no longer plan for. Anything else
 * changed nothing. Returns `null` when every refusal landed on a field.
 */
export function serverProblem(
  failure: unknown,
  setError: UseFormSetError<SessionValues>,
  messages: FieldMessages,
): Problem | null {
  if (!isApiError(failure) || failure.kind !== "http") return "failed";
  if (failure.status === 404) return "unavailable";
  if (failure.code === "conflict") {
    return failure.details["client_request_id"] === undefined ? "conflict" : "reused";
  }
  if (failure.code !== "validation_error") return "failed";

  const codes = failure.fieldCodes;
  const fields: [string, keyof SessionValues, string][] = [
    ["relationship_id", "relationshipId", messages.fighter],
    ["title", "title", messages.title],
    ["training_type", "trainingType", messages.type],
    [
      "starts_at",
      "time",
      codes.starts_at?.includes("out_of_range") ? messages.startWindow : messages.startInvalid,
    ],
    ["time_zone", "timeZone", messages.zone],
    ["duration_minutes", "duration", messages.duration],
    ["notes", "notes", messages.notes],
  ];
  let applied = false;
  for (const [field, name, message] of fields) {
    if (codes[field] === undefined) continue;
    setError(name, { type: "server", message });
    applied = true;
  }
  return applied ? null : "failed";
}
