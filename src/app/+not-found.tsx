import { Stack } from "expo-router";

import { NotFoundState } from "@/widgets/system-states";

/** ER1 · unknown routes, unrecognised deep links and deferred paths (SF-34). */
export default function NotFoundRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NotFoundState />
    </>
  );
}
