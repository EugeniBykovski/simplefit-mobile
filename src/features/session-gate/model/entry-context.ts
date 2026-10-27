import { callWithSession } from "@/entities/session";
import { chooseMyEntryContext } from "@/shared/api/generated/endpoints/entry/entry";
import type { EntryContextChoiceRequestContext } from "@/shared/api/generated/model";

/**
 * Records the explicit choice of a completed profile context
 * (`PUT /api/v1/me/entry/context`, SF-51): 204, or 409 when that profile is
 * not completed. Only for a finished journey; an unfinished one is entered
 * with an intent, never with this call. The entry resolver reads the choice;
 * the app stores nothing. The Gym context names its completed gym (`gymId`,
 * SF-84); the backend checks the membership.
 */
export async function chooseEntryContext(
  context: EntryContextChoiceRequestContext,
  gymId?: string,
) {
  await callWithSession((init) =>
    chooseMyEntryContext({ context, ...(gymId === undefined ? {} : { gym_id: gymId }) }, init),
  );
}
