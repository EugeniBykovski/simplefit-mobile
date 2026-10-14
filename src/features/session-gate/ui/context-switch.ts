import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";

import type { ProfileContext } from "../model/contexts";
import { entryHref, fetchEntry, isKnownEntry } from "../model/entry";
import { chooseEntryContext } from "../model/entry-context";

export type ContextSwitchState =
  | { status: "idle" }
  | { status: "pending"; context: ProfileContext; kind: SwitchKind }
  | { status: "failed"; context: ProfileContext; kind: SwitchKind };

/** `open`: a completed context (recorded); `continue`: an unfinished journey (intent only). */
export type SwitchKind = "open" | "continue";

class UnexpectedDestination extends Error {}

/**
 * Moving between the profile contexts of one account (SF-51, SF-55), the
 * same session and identity throughout, as the web client's switcher:
 *
 * - **open** a completed context: the choice is recorded with the backend
 *   (`PUT /api/v1/me/entry/context`), then the entry is resolved again and
 *   the app replaces the current screen with where it answers (that
 *   context's home). The choice is the backend's last explicit context;
 *   nothing is kept on the device.
 * - **continue** an unfinished journey: the entry is resolved with that
 *   journey's explicit intent and the app pushes its onboarding. Nothing is
 *   recorded: an incomplete profile is never a context.
 *
 * One move at a time. A failure keeps the user where they are, in their
 * current context, to retry. The client decides no destination of its own.
 * `onLeave` runs just before navigating (a sheet closes itself there).
 */
export function useContextSwitch(onLeave?: () => void) {
  const router = useRouter();
  const [state, setState] = useState<ContextSwitchState>({ status: "idle" });
  const busy = useRef(false);

  const go = useCallback(
    async (context: ProfileContext, kind: SwitchKind) => {
      if (busy.current) return;
      busy.current = true;
      setState({ status: "pending", context, kind });
      const continuation = kind === "continue" ? { intent: context } : {};
      try {
        if (kind === "open") await chooseEntryContext(context);
        const entry = await fetchEntry(continuation);
        const destination: string = entry.destination;
        if (!isKnownEntry(entry)) {
          // A newer API than this client: observable, never guessed around.
          console.error(`Unknown entry destination "${destination}"`);
          throw new UnexpectedDestination();
        }
        onLeave?.();
        // Another context is another workspace: it replaces the current
        // screen, so Back does not return to the profile it left. A journey
        // is pushed: Back returns to the context the user started it from.
        const href = entryHref(entry, continuation);
        if (kind === "open") router.replace(href);
        else router.push(href);
        setState({ status: "idle" });
      } catch {
        setState({ status: "failed", context, kind });
      } finally {
        busy.current = false;
      }
    },
    [onLeave, router],
  );

  return {
    state,
    open: (context: ProfileContext) => go(context, "open"),
    continueJourney: (context: ProfileContext) => go(context, "continue"),
  };
}
