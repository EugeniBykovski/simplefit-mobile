import { render, screen, userEvent } from "@testing-library/react-native";

import { Button } from "./button";
import { Input } from "./input";
import { RadioGroup } from "./radio-group";
import { Spinner } from "./spinner";
import { Text } from "./text";

describe("Text", () => {
  it("exposes title and heading variants as headers", async () => {
    await render(
      <>
        <Text variant="title">Title</Text>
        <Text>Body</Text>
      </>,
    );
    expect(screen.getByRole("header", { name: "Title" })).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Body" })).toBeNull();
  });
});

describe("Button", () => {
  it("is an accessible button that reports presses", async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} />);

    const button = screen.getByRole("button", { name: "Save" });
    await userEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("reports disabled and busy states and ignores presses", async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} loading />);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toBeBusy();
    await userEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("Input", () => {
  it("is labelled and announces validation errors", async () => {
    await render(<Input label="Email" error="Has invalid format" />);

    expect(screen.getByLabelText("Email")).toBeOnTheScreen();
    expect(screen.getByRole("alert")).toHaveTextContent("Has invalid format");
  });

  it("accepts typed text", async () => {
    const onChangeText = jest.fn();
    await render(<Input label="Name" onChangeText={onChangeText} />);
    await userEvent.type(screen.getByLabelText("Name"), "Ali");
    expect(onChangeText).toHaveBeenLastCalledWith("Ali");
  });
});

describe("RadioGroup", () => {
  it("exposes a radiogroup with checked state", async () => {
    const onChange = jest.fn();
    await render(
      <RadioGroup
        label="Size"
        value="m"
        onChange={onChange}
        options={[
          { value: "s", label: "Small" },
          { value: "m", label: "Medium" },
        ]}
      />,
    );

    expect(screen.getByLabelText("Size")).toHaveProp("accessibilityRole", "radiogroup");
    expect(screen.getByRole("radio", { name: "Medium" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Small" })).not.toBeChecked();
    await userEvent.press(screen.getByRole("radio", { name: "Small" }));
    expect(onChange).toHaveBeenCalledWith("s");
  });
});

describe("Spinner", () => {
  it("is announced with its label", async () => {
    await render(<Spinner label="Loading" />);
    expect(screen.getByRole("progressbar", { name: "Loading" })).toBeOnTheScreen();
  });
});
