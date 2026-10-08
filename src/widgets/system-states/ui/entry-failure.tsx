import { useEntryFailure } from "@/features/session-gate";

import { FailureView } from "./failure-view";

/**
 * The failure state of the entry resolution (SF-45): the retryable failure
 * view. Rendered by the entry gates as their `failure` element.
 */
export function EntryFailure() {
  const { error, retry } = useEntryFailure();
  return <FailureView error={error} onRetry={retry} />;
}
