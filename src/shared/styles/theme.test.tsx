import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { getPreference, setPreference } from "@/shared/storage/preferences";

import { ThemeProvider, useTheme } from "./theme";
import { palettes } from "./tokens";

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("ThemeProvider", () => {
  it("defaults to the dark theme", async () => {
    const { result } = await renderHook(() => useTheme(), { wrapper });
    expect(result.current.preference).toBe("dark");
    expect(result.current.scheme).toBe("dark");
    expect(result.current.colors).toBe(palettes.dark);
  });

  it("persists an explicit choice and clears it when back to the default", async () => {
    const { result } = await renderHook(() => useTheme(), { wrapper });

    await act(() => result.current.setPreference("light"));
    expect(result.current.scheme).toBe("light");
    await waitFor(async () => expect(await getPreference("theme")).toBe("light"));

    await act(() => result.current.setPreference("dark"));
    await waitFor(async () => expect(await getPreference("theme")).toBeNull());
  });

  it("restores a stored preference", async () => {
    await setPreference("theme", "light");
    const { result } = await renderHook(() => useTheme(), { wrapper });
    await waitFor(() => expect(result.current.scheme).toBe("light"));
  });

  it("throws outside the provider", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(renderHook(() => useTheme())).rejects.toThrow("useTheme must be used inside");
  });
});
