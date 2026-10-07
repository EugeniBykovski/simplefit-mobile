import { restoreSession, useSession } from "@/entities/session";

import { FailureView } from "./failure-view";

/**
 * What SessionGate shows on a gated screen while the session cannot be
 * confirmed because of a network or server failure (SF-24): the production
 * failure state for that error (offline, unavailable, unexpected) with "Try
 * again", which retries the restore. The stored refresh token is kept; this
 * is never a sign-out.
 */
export function SessionFailure() {
  const { error } = useSession();
  return <FailureView error={error} onRetry={() => void restoreSession()} />;
}
