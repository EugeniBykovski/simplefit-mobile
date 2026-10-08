import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams } from "expo-router";
import { createContext, useContext, useState, type ReactNode } from "react";

import { getResolveMyEntryQueryKey } from "@/shared/api/generated/endpoints/entry/entry";
import { continuationOf, type Continuation } from "@/shared/routes/continuation";

import { entryHref, entryParams, fetchEntry, type Entry } from "../model/entry";

type EntryFailureState = { error: unknown; retry: () => void };

const EntryFailureContext = createContext<EntryFailureState | undefined>(undefined);

/** The failure of the entry resolution being rendered, for an entry gate's `failure` element. */
export function useEntryFailure(): EntryFailureState {
  const state = useContext(EntryFailureContext);
  if (state === undefined) throw new Error("useEntryFailure outside an entry gate's failure");
  return state;
}

/** Renders `failure` with the resolution's error and a retry. */
export function EntryFailureBoundary({
  error,
  retry,
  failure,
}: EntryFailureState & { failure: ReactNode }) {
  return <EntryFailureContext value={{ error, retry }}>{failure}</EntryFailureContext>;
}

/**
 * The entry of the signed-in user for `continuation` (`GET /api/v1/me/entry`).
 * Never cached between mounts: each resolution reflects current state.
 */
export function useEntry(continuation: Continuation, enabled = true) {
  return useQuery<Entry>({
    queryKey: getResolveMyEntryQueryKey(entryParams(continuation)),
    queryFn: ({ signal }) => fetchEntry(continuation, signal),
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
}

/**
 * Resolves the entry and replaces the current screen with its destination
 * (SF-45), carrying the screen's continuation. While it runs, `pending`
 * renders; a failure renders `failure` (which reads `useEntryFailure`), and a
 * transient failure never navigates.
 */
export function EntryRedirect({ pending, failure }: { pending: ReactNode; failure: ReactNode }) {
  const params = useLocalSearchParams();
  const [continuation] = useState(() => continuationOf(params));
  const query = useEntry(continuation);

  if (query.isError) {
    return (
      <EntryFailureBoundary
        error={query.error}
        retry={() => void query.refetch()}
        failure={failure}
      />
    );
  }
  if (query.data !== undefined) return <Redirect href={entryHref(query.data, continuation)} />;
  return pending;
}
