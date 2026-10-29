import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type ReactNode, type Ref } from "react";
import type { View } from "react-native";

import { gymQueryKey, type Gym } from "@/entities/gym";
import {
  FIRST_RUN_PERMISSION,
  isFinal,
  useGymFirstRun,
  useGymFirstRunActions,
  type GymFirstRun,
  type GymFirstRunAction,
} from "@/entities/gym-first-run";
import { isApiError } from "@/shared/api/http/api-error";

import type { GymTourStep } from "../model/tour";
import {
  FirstRunIntro,
  FirstRunLoading,
  FirstRunUnavailable,
  GymChecklist,
  SkipSheet,
} from "./gym-first-run";
import { GymTour } from "./gym-tour";

export type FirstRunMode = "off" | "loading" | "unavailable" | "offer" | "kept";

/**
 * The owner's first run on this gym's Gym pulse (SF-90 lifecycle, SF-92 UI),
 * read only with the `manage_first_run` permission (the owner): managers,
 * coaches and front desk never call it and keep G01. Modes:
 *
 * - `off`: no permission, a 403, `unavailable` (a draft; the gym gate never
 *   shows one here), or an outcome kept before this screen was opened
 *   (completed and dismissed never reopen: G01 shows).
 * - `loading`; `unavailable` (the read failed or the phone is offline: Gym
 *   pulse works without it, with a retry).
 * - `offer`: `not_started` or `in_progress` (started on another device).
 * - `kept`: an outcome kept on this screen (or by another device while it
 *   was open), said once until the next visit.
 *
 * A 404 means the gym itself is gone for this user: the gym is read again
 * and the gym gate covers the shell with "not available". An outcome the
 * backend kept elsewhere (409, a re-read after a lost answer, or a refresh
 * on returning to the foreground) closes the tour and the sheet and shows
 * what it kept.
 */
export function useOwnerFirstRun(
  gym: Gym,
  {
    checklistRef,
    reveal,
  }: {
    checklistRef: Ref<View>;
    reveal: (step: GymTourStep) => Promise<void>;
  },
) {
  const enabled = gym.viewer.permissions.includes(FIRST_RUN_PERMISSION);
  const query = useGymFirstRun(gym.id, enabled);
  const transition = useGymFirstRunActions(gym.id);
  const client = useQueryClient();
  const [keptHere, setKeptHere] = useState(false);
  const [pending, setPending] = useState<"start" | "dismiss">();
  const [failed, setFailed] = useState<"start" | "dismiss">();
  const [skipping, setSkipping] = useState(false);
  const [touring, setTouring] = useState(false);
  // The tour's own Finish is in flight or answered: its complete card is shown by the tour.
  const [finishing, setFinishing] = useState(false);

  const data = query.data?.gym_id === gym.id ? query.data : undefined;
  const status = isApiError(query.error) ? query.error.status : undefined;
  const offline =
    data === undefined &&
    (query.fetchStatus === "paused" || (isApiError(query.error) && query.error.kind !== "http"));

  // The gym is gone for this user (revoked meanwhile): the gate re-reads it and shows "not available".
  useEffect(() => {
    if (status === 404) void client.invalidateQueries({ queryKey: gymQueryKey(gym.id) });
  }, [client, gym.id, status]);

  // Another device ended it while the tour or the sheet was open: show what the backend kept.
  const final = data !== undefined && isFinal(data.status);
  if (final && (touring || skipping) && !finishing && pending === undefined) {
    setTouring(false);
    setSkipping(false);
    setKeptHere(true);
  }

  const act = useCallback(
    async (action: GymFirstRunAction): Promise<GymFirstRun> => {
      try {
        const kept = await transition(action);
        if (isFinal(kept.status)) setKeptHere(true);
        // The other outcome was kept elsewhere: the tour closes and the page shows it.
        if (action === "complete" && kept.status === "dismissed") {
          setFinishing(false);
          setTouring(false);
        }
        return kept;
      } catch (error) {
        if (isApiError(error) && error.status === 404) {
          void client.invalidateQueries({ queryKey: gymQueryKey(gym.id) });
        }
        throw error;
      }
    },
    [client, gym.id, transition],
  );

  const start = async () => {
    setPending("start");
    setFailed(undefined);
    try {
      const kept = await act("start");
      if (kept.status === "in_progress") {
        setFinishing(false);
        setTouring(true);
      }
    } catch {
      setFailed("start");
    } finally {
      setPending(undefined);
    }
  };

  const skip = async () => {
    setPending("dismiss");
    setFailed(undefined);
    try {
      await act("dismiss");
      setSkipping(false);
    } catch {
      setFailed("dismiss");
    } finally {
      setPending(undefined);
    }
  };

  let mode: FirstRunMode = "off";
  if (!enabled || status === 403 || status === 404) mode = "off";
  else if (data === undefined) mode = query.isError || offline ? "unavailable" : "loading";
  else if (data.status === "not_started" || data.status === "in_progress") mode = "offer";
  else if (keptHere && isFinal(data.status)) mode = "kept";

  let panel: ReactNode = null;
  if (mode === "loading") panel = <FirstRunLoading />;
  else if (mode === "unavailable")
    panel = <FirstRunUnavailable offline={offline} onRetry={() => void query.refetch()} />;
  else if (data !== undefined && (mode === "offer" || mode === "kept")) {
    panel = (
      <>
        <FirstRunIntro
          firstRun={data}
          pending={pending === "start"}
          failed={failed === "start"}
          onStart={() => void start()}
          onSkip={() => {
            setFailed(undefined);
            setSkipping(true);
          }}
        />
        <GymChecklist items={data.checklist} targetRef={checklistRef} />
      </>
    );
  }

  const overlays =
    !enabled || mode === "off" ? null : (
      <>
        <SkipSheet
          visible={skipping}
          pending={pending === "dismiss"}
          failed={failed === "dismiss"}
          onConfirm={() => void skip()}
          onCancel={() => {
            setFailed(undefined);
            setSkipping(false);
          }}
        />
        {touring ? (
          <GymTour
            gymName={gym.name}
            layout={`${mode}:${data?.status ?? ""}`}
            reveal={reveal}
            onComplete={async () => {
              setFinishing(true);
              try {
                return await act("complete");
              } catch (error) {
                setFinishing(false);
                throw error;
              }
            }}
            onDismiss={() => act("dismiss")}
            onClose={() => {
              setFinishing(false);
              setTouring(false);
            }}
          />
        ) : null}
      </>
    );

  return { mode, panel, overlays };
}
