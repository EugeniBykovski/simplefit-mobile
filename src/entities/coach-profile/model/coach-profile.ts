import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { callWithSession } from "@/entities/session";
import {
  completeMyCoachOnboarding,
  getGetMyCoachProfileQueryKey,
  getMyCoachProfile,
  updateMyCoachProfile,
} from "@/shared/api/generated/endpoints/coach-profile/coach-profile";
import { getResolveMyEntryQueryKey } from "@/shared/api/generated/endpoints/entry/entry";
import type {
  CoachProfileResponseCoachProfile,
  CoachProfileUpdateRequest,
} from "@/shared/api/generated/model";

/**
 * The signed-in user's CoachProfile (SF-50; simplefit-api ADR 0020), the only
 * authority on Coach onboarding: saved fields, `missing_requirements` and
 * `status` / `completed_at`. The same contract as the web client's. The app
 * keeps nothing of its own: every read and write goes through the generated
 * operations, and the cache holds the backend's latest answer. Separate from
 * the AccountProfile and the FighterProfile: nothing here writes either.
 */
export type CoachProfile = CoachProfileResponseCoachProfile;
export type CoachProfilePatch = CoachProfileUpdateRequest;

export const coachProfileQueryKey = getGetMyCoachProfileQueryKey();

/** `GET /api/v1/me/coach-profile` (always 200; `not_started` before the first save; creates nothing). */
export async function fetchCoachProfile(signal?: AbortSignal): Promise<CoachProfile> {
  const { coach_profile } = await callWithSession((init) => getMyCoachProfile({ ...init, signal }));
  return coach_profile;
}

/**
 * The current profile. Read fresh on every screen entry and when the app
 * returns to the foreground, so a save from the web client or another
 * device is reconciled instead of overwritten.
 */
export function useCoachProfile() {
  return useQuery({
    queryKey: coachProfileQueryKey,
    queryFn: ({ signal }) => fetchCoachProfile(signal),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * The profile's writes. Each resolves with the backend's profile, which
 * replaces the cache; nothing is written optimistically. A completion also
 * drops the cached entry resolutions, so the next one reports COACH.
 */
export function useCoachProfileActions() {
  const client = useQueryClient();
  const settle = useCallback(
    (profile: CoachProfile) => {
      client.setQueryData(coachProfileQueryKey, profile);
      return profile;
    },
    [client],
  );

  /** `PATCH`: any subset; omitted fields stay, `null` or `[]` clears. The first save creates the profile. */
  const save = useCallback(
    async (patch: CoachProfilePatch) =>
      settle((await callWithSession((init) => updateMyCoachProfile(patch, init))).coach_profile),
    [settle],
  );

  /** `POST …/complete-onboarding`: the server checks every requirement; repeating keeps `completed_at`. */
  const complete = useCallback(async () => {
    const { coach_profile } = await callWithSession((init) => completeMyCoachOnboarding(init));
    const profile = settle(coach_profile);
    await client.invalidateQueries({ queryKey: getResolveMyEntryQueryKey().slice(0, 1) });
    return profile;
  }, [client, settle]);

  return { save, complete };
}
