import { screen, userEvent } from "@testing-library/react-native";

import { renderWithProviders } from "@/test/render";

import { DesignSystemGallery } from "./design-system-gallery";

describe("DesignSystemGallery", () => {
  it("renders every primitive family", async () => {
    await renderWithProviders(<DesignSystemGallery />);

    expect(screen.getByRole("header", { name: "Design system" })).toBeOnTheScreen();
    for (const name of ["primary", "secondary", "outline", "ghost", "destructive"]) {
      expect(screen.getByRole("button", { name })).toBeOnTheScreen();
    }
    expect(screen.getByRole("checkbox", { name: "Remember me" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Round notifications" })).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Round 1" })).toBeSelected();
    expect(screen.getByRole("image", { name: "Maria Coach" })).toBeOnTheScreen();
    expect(screen.getByRole("progressbar", { name: "Loading sessions" })).toBeOnTheScreen();
  });

  it("switches theme live and shows toasts", async () => {
    await renderWithProviders(<DesignSystemGallery />);
    expect(screen.getByText(/dark theme/)).toBeOnTheScreen();

    await userEvent.press(screen.getByRole("radio", { name: "Light" }));
    expect(screen.getByText(/light theme/)).toBeOnTheScreen();

    await userEvent.press(screen.getByRole("button", { name: "Success" }));
    expect(screen.getByRole("alert", { name: "Round logged" })).toBeOnTheScreen();
  });
});
