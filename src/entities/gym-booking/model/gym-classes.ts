import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { callWithSession } from "@/entities/session";
import {
  getGymClassOccurrence,
  listGymClassOccurrences,
} from "@/shared/api/generated/endpoints/gym-timetable/gym-timetable";
import type { GymClassOccurrence as Occurrence } from "@/shared/api/generated/model";

/**
 * One dated class of a gym as its staff read it (SF-97): UTC instants, the
 * venue's IANA zone and the wall times there, venue, instructor (a short
 * name, or none), capacity and the backend's status. The app never builds a
 * class from a weekly rule: every class shown is a row of this list.
 */
export type GymClassOccurrence = Occurrence;

const DAY = 86_400_000;
/** Every zone's wall day overlaps [midnight − 14 h, midnight + 38 h) UTC. */
const ZONE_REACH = 14 * 3_600_000;
const utcMidnight = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** A calendar date (`YYYY-MM-DD`) `days` later. */
export const addDays = (date: string, days: number) =>
  new Date(utcMidnight(date) + days * DAY).toISOString().slice(0, 10);
/** The dates from `start`, `count` of them. */
export const datesFrom = (start: string, count: number) =>
  Array.from({ length: count }, (_, index) => addDays(start, index));
/**
 * The instants that hold every class whose wall date is between `first`
 * and `last` in any zone (the backend filters by instant; the client keeps
 * the classes of the wall dates it shows).
 */
export const windowFor = (first: string, last: string) => ({
  from: new Date(utcMidnight(first) - ZONE_REACH).toISOString(),
  to: new Date(utcMidnight(last) + DAY + ZONE_REACH).toISOString(),
});
/** The wall date of a backend wall time (`YYYY-MM-DDTHH:MM:SS`). */
export const wallDate = (local: string) => local.slice(0, 10);
/** `HH:MM` of a backend wall time. */
export const wallClock = (local: string) => local.slice(11, 16);
/** A wall date as a Date at its UTC noon, to print with `timeZone: "UTC"` in any locale. */
export const printable = (date: string) => new Date(utcMidnight(date) + DAY / 2);
/** The device's own calendar date. */
export const deviceToday = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

const PAGE_SIZE = 100;

export const gymClassesKey = (gymId: string) => ["gym-classes", gymId] as const;

/**
 * A gym's classes in a window (`GET /gyms/{id}/class-occurrences`, scheduled
 * and cancelled), every page; `complete` is false until the last page has
 * arrived, and nothing is shown as the whole window before then.
 */
export function useGymClassOccurrences(gymId: string, window: { from: string; to: string }) {
  const query = useInfiniteQuery({
    queryKey: [...gymClassesKey(gymId), "window", window],
    queryFn: ({ pageParam, signal }) =>
      callWithSession((init) =>
        listGymClassOccurrences(
          gymId,
          {
            from: window.from,
            to: window.to,
            limit: PAGE_SIZE,
            ...(pageParam === null ? {} : { cursor: pageParam }),
          },
          { ...init, signal },
        ),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);
  const complete = query.data !== undefined && !query.hasNextPage && !query.isError;
  return {
    query,
    complete,
    occurrences: complete ? query.data.pages.flatMap((page) => page.occurrences) : [],
  };
}

/** One class of a gym (`GET /gyms/{id}/class-occurrences/{id}`). */
export function useGymClassOccurrence(gymId: string, occurrenceId: string) {
  return useQuery({
    queryKey: [...gymClassesKey(gymId), "one", occurrenceId],
    queryFn: ({ signal }) =>
      callWithSession((init) => getGymClassOccurrence(gymId, occurrenceId, { ...init, signal })),
    select: (answer) => answer.occurrence,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
