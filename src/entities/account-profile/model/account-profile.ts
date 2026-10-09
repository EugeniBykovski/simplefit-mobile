import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { callWithSession } from "@/entities/session";
import {
  completeAccountRegistration,
  getGetMyAccountProfileQueryKey,
  getMyAccountProfile,
  updateMyAccountProfile,
} from "@/shared/api/generated/endpoints/account/account";
import { getResolveMyEntryQueryKey } from "@/shared/api/generated/endpoints/entry/entry";
import type {
  AccountProfileResponseAccountProfile,
  AccountProfileUpdateRequest,
} from "@/shared/api/generated/model";
import { isApiError } from "@/shared/api/http/api-error";

/**
 * The signed-in user's shared account registration (SF-44; simplefit-api
 * ADR 0016), the same contract as the web client's: full name, date of
 * birth, versioned consents, product news and `registration` (status,
 * `missing_requirements`, `completed_at`). The backend is the only
 * authority; the cache holds its latest answer. Reading creates nothing;
 * nothing is written optimistically.
 */
export type AccountProfile = AccountProfileResponseAccountProfile;
export type AccountProfilePatch = AccountProfileUpdateRequest;

export const accountProfileQueryKey = getGetMyAccountProfileQueryKey();

/** `GET /api/v1/me/account-profile` (always 200; `not_started` before the first save). */
export async function fetchAccountProfile(signal?: AbortSignal): Promise<AccountProfile> {
  const { account_profile } = await callWithSession((init) =>
    getMyAccountProfile({ ...init, signal }),
  );
  return account_profile;
}

/** The current registration, read fresh on every screen entry (another client may have changed it). */
export function useAccountProfile() {
  return useQuery({
    queryKey: accountProfileQueryKey,
    queryFn: ({ signal }) => fetchAccountProfile(signal),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
}

/**
 * The registration's writes. Each resolves with the backend's state, which
 * replaces the cache. A completion also drops the cached entry resolutions,
 * so the next one reflects it.
 */
export function useAccountProfileActions() {
  const client = useQueryClient();
  const settle = useCallback(
    (profile: AccountProfile) => {
      client.setQueryData(accountProfileQueryKey, profile);
      return profile;
    },
    [client],
  );

  /** `PATCH`: any subset; consents are recorded at their current version by the server. */
  const save = useCallback(
    async (patch: AccountProfilePatch) =>
      settle(
        (await callWithSession((init) => updateMyAccountProfile(patch, init))).account_profile,
      ),
    [settle],
  );

  /**
   * `POST …/complete-registration`: the server checks every requirement;
   * repeating keeps `completed_at`. A rejection reloads the registration, so
   * the screen shows what the server checked.
   */
  const complete = useCallback(async () => {
    let response;
    try {
      response = await callWithSession((init) => completeAccountRegistration(init));
    } catch (error) {
      if (isApiError(error) && error.code === "validation_error")
        void client.invalidateQueries({ queryKey: accountProfileQueryKey });
      throw error;
    }
    const profile = settle(response.account_profile);
    await client.invalidateQueries({ queryKey: getResolveMyEntryQueryKey().slice(0, 1) });
    return profile;
  }, [client, settle]);

  return { save, complete };
}
