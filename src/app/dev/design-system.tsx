import { routeHref } from "@/shared/routes/routes";
import { Redirect, Stack } from "expo-router";

import { DesignSystemGallery } from "@/widgets/design-system-gallery";

/** Developer-only design system gallery; redirects home in production builds. */
export default function DesignSystemRoute() {
  if (!__DEV__) return <Redirect href={routeHref("mobile.root")} />;

  return (
    <>
      <Stack.Screen options={{ title: "Design system" }} />
      <DesignSystemGallery />
    </>
  );
}
