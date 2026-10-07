import { Redirect, usePathname, useRouter } from "expo-router";
import { View } from "react-native";

import { mobileGuards, routeHref, signInHref } from "@/shared/routes/routes";

import { failureFor } from "../model/failure";
import { ErrorState } from "./error-state";

/**
 * The body of the Expo Router error boundary: the failure state of `error`,
 * centred. A 401 is not a screen: the session has ended, so it goes to
 * sign-in with `returnTo`, like SessionGate (route-architecture §9).
 */
export function FailureView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const failure = failureFor(error);
  const router = useRouter();
  const pathname = usePathname();

  if (failure === "unauthorized") return <Redirect href={signInHref(pathname)} />;

  return (
    <View className="flex-1 items-center justify-center bg-background p-5">
      <ErrorState
        kind={failure}
        onRetry={onRetry}
        onHome={() => router.replace(routeHref(mobileGuards.entry))}
      />
    </View>
  );
}
