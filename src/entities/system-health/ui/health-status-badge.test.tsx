import { screen } from "@testing-library/react-native";

import { renderWithProviders } from "@/test/render";

import { HealthStatusBadge } from "./health-status-badge";

describe("HealthStatusBadge", () => {
  it.each([
    ["online", "Online"],
    ["offline", "Offline"],
    ["checking", "Checking"],
  ] as const)("communicates %s with text, not colour alone", async (status, label) => {
    await renderWithProviders(<HealthStatusBadge status={status} />);
    expect(screen.getByLabelText(label)).toBeOnTheScreen();
    expect(screen.getByText(label)).toBeOnTheScreen();
  });
});
