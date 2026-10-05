import { act, renderHook } from "@testing-library/react-native";
import { useForm } from "react-hook-form";

import { ApiError } from "@/shared/api/http/api-error";

import { applyApiFieldErrors } from "./forms";

type Values = { email: string; date_of_birth: string };

const setup = () =>
  renderHook(() => {
    const form = useForm<Values>({ defaultValues: { email: "", date_of_birth: "" } });
    // formState is a subscription proxy: read errors during render to track them.
    void form.formState.errors;
    return form;
  });

const validationError = (fields: Record<string, string[]>) =>
  new ApiError("http", 422, "validation_error", "Request validation failed", { fields }, "req-1");

describe("applyApiFieldErrors", () => {
  it("sets backend messages on known fields and collects the rest on root.server", async () => {
    const { result } = await setup();

    let handled = false;
    await act(() => {
      handled = applyApiFieldErrors(
        validationError({ email: ["has invalid format", "is taken"], nickname: ["too long"] }),
        result.current.setError,
        ["email", "date_of_birth"],
      );
    });

    expect(handled).toBe(true);
    expect(result.current.formState.errors.email?.message).toBe("has invalid format is taken");
    expect(result.current.formState.errors.root?.server?.message).toBe("nickname: too long");
  });

  it("ignores errors that are not backend validation errors", async () => {
    const { result } = await setup();
    expect(
      applyApiFieldErrors(
        new ApiError("http", 409, "conflict", "Conflict", {}, null),
        result.current.setError,
        ["email"],
      ),
    ).toBe(false);
    expect(applyApiFieldErrors(new Error("boom"), result.current.setError, ["email"])).toBe(false);
  });
});
