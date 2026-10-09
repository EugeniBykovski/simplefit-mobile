import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { callWithSession } from "@/entities/session";
import {
  getListMyFirstRunExperiencesQueryKey,
  listMyFirstRunExperiences,
  recordMyFirstRunOutcome,
} from "@/shared/api/generated/endpoints/first-run/first-run";
import type {
  FirstRunExperience,
  FirstRunExperienceExperience,
  FirstRunOutcomeRequestOutcome,
} from "@/shared/api/generated/model";

/**
 * The signed-in user's one-time first-run experiences (SF-40, SF-41;
 * simplefit-api ADR 0018), the same contract as the web client's. The backend
 * derives each status on every read (`unavailable`, `pending`) and keeps the
 * first outcome recorded (`completed` or `dismissed`) for good, across
 * devices. Nothing is kept on the device: an unfinished experience is simply
 * still `pending`.
 */
export type FirstRunState = FirstRunExperience;
export type FirstRunExperienceKey = FirstRunExperienceExperience;
export type FirstRunOutcome = FirstRunOutcomeRequestOutcome;

/** The Fighter mobile introduction (FR1–FR3). Independent of `fighter_web_tour`. */
export const FIGHTER_MOBILE_FIRST_RUN: FirstRunExperienceKey = "fighter_mobile_first_run";

export const firstRunQueryKey = getListMyFirstRunExperiencesQueryKey();

/** `GET /api/v1/me/first-run`: every experience with its status. */
export async function fetchFirstRun(signal?: AbortSignal): Promise<FirstRunState[]> {
  const { experiences } = await callWithSession((init) =>
    listMyFirstRunExperiences({ ...init, signal }),
  );
  return experiences;
}

/**
 * One experience's state, read fresh on every screen entry and when the app
 * returns to the foreground. An experience this API does not list is treated
 * as `unavailable`, never as pending.
 */
export function useFirstRun(experience: FirstRunExperienceKey) {
  return useQuery({
    queryKey: firstRunQueryKey,
    queryFn: ({ signal }) => fetchFirstRun(signal),
    select: (experiences): FirstRunState =>
      experiences.find((state) => state.experience === experience) ?? {
        experience,
        status: "unavailable",
        recorded_at: null,
      },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * `PUT /api/v1/me/first-run/{experience}`: records how the person left the
 * experience. Resolves with the outcome the backend keeps, which is the
 * first one ever recorded (another device's, if it was first), and puts it
 * in the cache. Nothing is written optimistically.
 */
export function useRecordFirstRunOutcome(experience: FirstRunExperienceKey) {
  const client = useQueryClient();
  return useCallback(
    async (outcome: FirstRunOutcome): Promise<FirstRunState> => {
      const { experience: kept } = await callWithSession((init) =>
        recordMyFirstRunOutcome(experience, { outcome }, init),
      );
      client.setQueryData<FirstRunState[]>(firstRunQueryKey, (current = []) => [
        ...current.filter((state) => state.experience !== kept.experience),
        kept,
      ]);
      return kept;
    },
    [client, experience],
  );
}
