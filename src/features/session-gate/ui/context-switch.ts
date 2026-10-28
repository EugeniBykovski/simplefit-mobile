import { useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { getResolveMyEntryQueryKey } from "@/shared/api/generated/endpoints/entry/entry";
import type { Continuation } from "@/shared/routes/continuation";
import { routeHref } from "@/shared/routes/routes";

import type { ProfileContext } from "../model/contexts";
import { entryHref, fetchEntry, isKnownEntry } from "../model/entry";
import { chooseEntryContext } from "../model/entry-context";

/**
 * What a move opens: a profile context, a gym workspace (`gym:<id>`) or the
 * setup of the user's own draft gym (`gym-setup`). Rows compare it with
 * their own target to show which one is opening or failed.
 */
export type SwitchTarget = ProfileContext | `gym:${string}` | "gym-setup";

export const gymTarget = (gymId: string): SwitchTarget => `gym:${gymId}`;

export type ContextSwitchState =
  | { status: "idle" }
  | { status: "pending"; target: SwitchTarget; kind: SwitchKind }
  | { status: "failed"; target: SwitchTarget; kind: SwitchKind };

/** `open`: a completed context or gym (recorded); `continue`: an unfinished journey or draft (intent only). */
export type SwitchKind = "open" | "continue";

class UnexpectedDestination extends Error {}

/**
 * Moving between the contexts of one account (SF-51, SF-55, SF-89), the same
 * session and identity throughout, as the web client's switcher:
 *
 * - **open** a completed profile context: the choice is recorded with the
 *   backend (`PUT /api/v1/me/entry/context`), then the entry is resolved
 *   again and the app replaces the current screen with where it answers
 *   (that context's home);
 * - **open** a gym workspace: the choice (`context: gym` with the gym id) is
 *   recorded, which the backend accepts only for a completed gym where the
 *   user is active staff, then the app replaces the current screen with that
 *   gym's Gym pulse, whose route names the gym. The record is the landing
 *   preference of the next cold start, never authority: every gym screen is
 *   authorized for the gym in its route;
 * - **continue** an unfinished journey (a profile, or the user's own draft
 *   gym): the entry is resolved with that journey's explicit intent and the
 *   app pushes where it answers (its onboarding, which resumes the draft).
 *   Nothing is recorded: an incomplete profile or a draft is never a context.
 *
 * One move at a time. A failure keeps the user where they are, in their
 * current context, to retry, and refreshes the entry, so a gym revoked
 * meanwhile disappears from every list. The client decides no destination of
 * its own. `onLeave` runs just before navigating (a sheet closes itself
 * there).
 */
export function useContextSwitch(onLeave?: () => void) {
  const router = useRouter();
  const client = useQueryClient();
  const [state, setState] = useState<ContextSwitchState>({ status: "idle" });
  const busy = useRef(false);

  const run = useCallback(
    async (target: SwitchTarget, kind: SwitchKind, move: () => Promise<Href>) => {
      if (busy.current) return;
      busy.current = true;
      setState({ status: "pending", target, kind });
      try {
        const href = await move();
        onLeave?.();
        // Another context is another workspace: it replaces the current
        // screen, so Back does not return to the one it left. A journey is
        // pushed: Back returns to the context the user started it from.
        if (kind === "open") router.replace(href);
        else router.push(href);
        setState({ status: "idle" });
      } catch {
        setState({ status: "failed", target, kind });
        void client.invalidateQueries({ queryKey: getResolveMyEntryQueryKey() });
      } finally {
        busy.current = false;
      }
    },
    [client, onLeave, router],
  );

  const resolve = useCallback(async (continuation: Continuation) => {
    const entry = await fetchEntry(continuation);
    const destination: string = entry.destination;
    if (!isKnownEntry(entry)) {
      // A newer API than this client: observable, never guessed around.
      console.error(`Unknown entry destination "${destination}"`);
      throw new UnexpectedDestination();
    }
    return entryHref(entry, continuation);
  }, []);

  return {
    state,
    open: (context: ProfileContext) =>
      run(context, "open", async () => {
        await chooseEntryContext(context);
        return resolve({});
      }),
    continueJourney: (context: ProfileContext) =>
      run(context, "continue", () => resolve({ intent: context })),
    openGym: (gymId: string) =>
      run(gymTarget(gymId), "open", async () => {
        await chooseEntryContext("gym", gymId);
        return routeHref("mobile.gyms._gym-id.pulse", { gymId });
      }),
    continueGymSetup: () => run("gym-setup", "continue", () => resolve({ intent: "gym" })),
  };
}
