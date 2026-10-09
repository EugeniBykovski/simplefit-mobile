import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { callWithSession } from "@/entities/session";
import { getResolveMyEntryQueryKey } from "@/shared/api/generated/endpoints/entry/entry";
import {
  completeFighterOnboarding,
  getGetMyFighterProfileQueryKey,
  getMyFighterProfile,
  updateMyFighterProfile,
} from "@/shared/api/generated/endpoints/fighter-profile/fighter-profile";
import type {
  FighterProfileResponseFighterProfile,
  FighterProfileUpdateRequest,
} from "@/shared/api/generated/model";

/**
 * The signed-in user's FighterProfile (SF-25; simplefit-api ADR 0015), the
 * only authority on Fighter onboarding: saved fields, `missing_requirements`
 * and `status` / `completed_at`. The same contract as the web client's. The
 * app keeps nothing of its own: every read and write goes through the
 * generated operations, and the cache holds the backend's latest answer.
 */
export type FighterProfile = FighterProfileResponseFighterProfile;
export type FighterProfilePatch = FighterProfileUpdateRequest;

export const fighterProfileQueryKey = getGetMyFighterProfileQueryKey();

/** `GET /api/v1/me/fighter-profile` (always 200; `not_started` before the first save). */
export async function fetchFighterProfile(signal?: AbortSignal): Promise<FighterProfile> {
  const { fighter_profile } = await callWithSession((init) =>
    getMyFighterProfile({ ...init, signal }),
  );
  return fighter_profile;
}

/**
 * The current profile. Read fresh on every screen entry and when the app
 * returns to the foreground, so a save from the web client or another
 * device is reconciled instead of overwritten.
 */
export function useFighterProfile() {
  return useQuery({
    queryKey: fighterProfileQueryKey,
    queryFn: ({ signal }) => fetchFighterProfile(signal),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * The profile's writes. Each resolves with the backend's profile, which
 * replaces the cache; nothing is written optimistically. A completion also
 * drops the cached entry resolutions, so the next one reflects it.
 */
export function useFighterProfileActions() {
  const client = useQueryClient();
  const settle = useCallback(
    (profile: FighterProfile) => {
      client.setQueryData(fighterProfileQueryKey, profile);
      return profile;
    },
    [client],
  );

  /** `PATCH`: any subset; omitted fields stay, `null` clears. The first save creates the profile. */
  const save = useCallback(
    async (patch: FighterProfilePatch) =>
      settle(
        (await callWithSession((init) => updateMyFighterProfile(patch, init))).fighter_profile,
      ),
    [settle],
  );

  /** `POST …/complete-onboarding`: the server checks every requirement; repeating keeps `completed_at`. */
  const complete = useCallback(async () => {
    const { fighter_profile } = await callWithSession((init) => completeFighterOnboarding(init));
    const profile = settle(fighter_profile);
    await client.invalidateQueries({ queryKey: getResolveMyEntryQueryKey().slice(0, 1) });
    return profile;
  }, [client, settle]);

  return { save, complete };
}
