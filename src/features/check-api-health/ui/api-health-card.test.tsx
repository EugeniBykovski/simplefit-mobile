import { screen, userEvent } from "@testing-library/react-native";

import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { ApiHealthCard } from "./api-health-card";

const healthy = () => jsonResponse({ status: "ok", service: "simplefit-api" });

describe("ApiHealthCard", () => {
  it("shows the API online after a successful health check", async () => {
    mockFetch(jest.fn().mockResolvedValue(healthy()));
    await renderWithProviders(<ApiHealthCard />);

    expect(screen.getByRole("header", { name: "API connection" })).toBeOnTheScreen();
    expect(await screen.findByLabelText("Online")).toBeOnTheScreen();
    expect(screen.getByText("http://api.test")).toBeOnTheScreen();
    expect(screen.getByText(/^Last checked at /)).toBeOnTheScreen();
  });

  it("shows offline without crashing when the network fails", async () => {
    mockFetch(jest.fn().mockRejectedValue(new TypeError("Network request failed")));
    await renderWithProviders(<ApiHealthCard />);

    expect(await screen.findByLabelText("Offline")).toBeOnTheScreen();
    expect(screen.getByText("The API could not be reached.")).toBeOnTheScreen();
    expect(screen.getByText("network_error")).toBeOnTheScreen();
  });

  it("shows the backend error code and request id for HTTP errors", async () => {
    mockFetch(
      jest.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: "service_unavailable",
              message: "The service is temporarily unavailable",
              details: {},
              request_id: "req-9",
            },
          },
          { status: 503 },
        ),
      ),
    );
    await renderWithProviders(<ApiHealthCard />);

    expect(await screen.findByLabelText("Offline")).toBeOnTheScreen();
    expect(screen.getByText("service_unavailable")).toBeOnTheScreen();
    expect(screen.getByText("Request ID: req-9")).toBeOnTheScreen();
  });

  it("re-checks on demand", async () => {
    const fetchMock = mockFetch(
      jest.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValue(healthy()),
    );
    await renderWithProviders(<ApiHealthCard />);
    expect(await screen.findByLabelText("Offline")).toBeOnTheScreen();

    await userEvent.press(screen.getByRole("button", { name: "Check again" }));

    expect(await screen.findByLabelText("Online")).toBeOnTheScreen();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("is translated (es-MX regional override)", async () => {
    mockFetch(jest.fn().mockResolvedValue(healthy()));
    await renderWithProviders(<ApiHealthCard />, { storedLocale: "es-MX" });

    expect(screen.getByRole("header", { name: "Conexión con la API" })).toBeOnTheScreen();
    expect(await screen.findByLabelText("En línea")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Verificar de nuevo" })).toBeOnTheScreen();
  });
});
