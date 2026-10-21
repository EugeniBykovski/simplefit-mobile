import { screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { renderWithProviders } from "@/test/render";

import { useTabTitle } from "./tabs-title";

/*
 * The title of a shell's `(tabs)` screen (SF-69 cleanup): the focused tab's
 * label, which a screen pushed above the tabs announces on its native back
 * button, never the route group's name "(tabs)".
 */

function Probe() {
  const title = useTabTitle("fighter");
  return <Text testID="titles">{["(home)", "(training)", "(profile)"].map(title).join("|")}</Text>;
}

describe("useTabTitle", () => {
  it("names a tab by its label, in the app language", async () => {
    await renderWithProviders(<Probe />);
    expect(screen.getByTestId("titles")).toHaveTextContent("Home|Training|Profile");
  });
});
