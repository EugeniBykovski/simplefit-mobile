import { Slot } from "expo-router";

/**
 * The future signed-in area. The authentication ticket adds its guard here
 * (redirect to the (auth) group when there is no session) and switches to a
 * Stack or Tabs navigator when the area has more than one screen.
 */
export default function AppGroupLayout() {
  return <Slot />;
}
