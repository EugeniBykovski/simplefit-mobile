import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { parseIntent, type Continuation, type EntryIntent } from "@/shared/routes/continuation";

import { entryHref, fetchEntry, knowsDestination, type Entry } from "../model/entry";

export type EntryChoiceState =
  | { status: "idle" }
  | { status: "resolving"; intent: EntryIntent }
  | { status: "failed"; intent: EntryIntent; reason: "unavailable" | "unexpected" };

class UnexpectedDestination extends Error {}

/**
 * O05's choice (SF-45), as the web WA6: asks the entry resolver again with
 * the chosen journey's intent and goes where it answers, through the same
 * mapping and precedence as every entry. Nothing is stored or created; one
 * resolution runs at a time.
 *
 * `sponsor_application` is handed to `onSponsor` (mobile has no sponsor
 * surface: the partner application is on the web). A destination this client
 * does not map is `unexpected`, never a guessed route.
 */
export function useEntryChoice(
  continuation: Continuation,
  onSponsor: (entry: Entry) => Promise<void> | void,
) {
  const router = useRouter();
  const [state, setState] = useState<EntryChoiceState>({ status: "idle" });
  const busy = useRef(false);

  const choose = useCallback(
    async (value: string) => {
      const intent = parseIntent(value);
      if (intent === undefined || busy.current) return;
      busy.current = true;
      setState({ status: "resolving", intent });
      const chosen = { ...continuation, intent };
      try {
        const entry = await fetchEntry(chosen);
        if (!knowsDestination(entry.destination)) {
          console.error(`Unknown entry destination "${entry.destination}"`);
          throw new UnexpectedDestination();
        }
        if (entry.destination === "sponsor_application") await onSponsor(entry);
        else router.push(entryHref(entry, chosen));
        setState({ status: "idle" });
      } catch (error) {
        setState({
          status: "failed",
          intent,
          reason: error instanceof UnexpectedDestination ? "unexpected" : "unavailable",
        });
      } finally {
        busy.current = false;
      }
    },
    [continuation, onSponsor, router],
  );

  return { state, choose };
}
