import { systemPathOf } from "@/features/coach-invitation-link";
import { publicEnv } from "@/shared/config/env";

/**
 * Every URL the system opens the app with (a cold start and each later
 * link), before Expo Router reads it (SF-80). Verified invitation links lead
 * to the invitation entry; no URL fragment ever reaches navigation state.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return systemPathOf(path, publicEnv.appLinkHost);
}
