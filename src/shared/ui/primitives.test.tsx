import { act, fireEvent, screen, userEvent } from "@testing-library/react-native";
import { Plus } from "lucide-react-native";
import { AccessibilityInfo } from "react-native";

import { renderWithProviders } from "@/test/render";

import { Avatar, initialsOf } from "./avatar";
import { Badge } from "./badge";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Modal } from "./modal";
import { RadioGroup } from "./radio-group";
import { SegmentedControl } from "./segmented-control";
import { Skeleton } from "./skeleton";
import { Spinner } from "./spinner";
import { Switch } from "./switch";
import { Text, textFamily } from "./text";
import { Textarea } from "./textarea";
import { useToast } from "./toast";

describe("Text", () => {
  it("exposes display and heading variants as headers", async () => {
    await renderWithProviders(
      <>
        <Text variant="display">Display</Text>
        <Text variant="h2">Heading</Text>
        <Text variant="title">Title</Text>
        <Text>Body</Text>
      </>,
    );
    expect(screen.getByRole("header", { name: "Display" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Heading" })).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Title" })).toBeNull();
    expect(screen.queryByRole("header", { name: "Body" })).toBeNull();
  });

  it("raises Manrope roles to the requested weight and keeps display and mono families", () => {
    expect(textFamily("body")).toBe("font-sans");
    expect(textFamily("caption", "bold")).toBe("font-sans-bold");
    expect(textFamily("bodySm", "extrabold")).toBe("font-sans-extrabold");
    expect(textFamily("h1", "extrabold")).toBe("font-display");
    expect(textFamily("metric")).toBe("font-display-bold");
    expect(textFamily("label", "bold")).toBe("font-mono");
  });
});

describe("Button", () => {
  it("is an accessible button that reports presses", async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <Button label="Save" icon={Plus} variant="outline" onPress={onPress} />,
    );

    await userEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("reports busy while loading and ignores presses", async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Save" onPress={onPress} loading />);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toBeBusy();
    await userEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("is disabled without being busy", async () => {
    await renderWithProviders(
      <Button label="Delete" variant="destructive" disabled onPress={jest.fn()} />,
    );
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toBeDisabled();
    expect(button).not.toBeBusy();
  });

  // Canonical mobile control sizes (docs/design-tokens.json controls.button.mobile).
  it.each([
    ["sm", ["min-h-button-sm", "rounded-full"]],
    ["md", ["min-h-button-md", "rounded-xl"]],
    ["lg", ["min-h-button-lg", "rounded-xl"]],
    ["system", ["min-h-button-system", "rounded-md"]],
    ["gym", ["min-h-touch-gym", "rounded-2xl"]],
  ] as const)("renders the %s size at its canonical height and radius", async (size, classes) => {
    await renderWithProviders(<Button label="Start" size={size} onPress={jest.fn()} />);
    const button = screen.getByRole("button", { name: "Start" });
    for (const name of classes) expect(button.props.className).toContain(name);
  });

  it("extends the 36 pt small button to a 44 pt touch target", async () => {
    await renderWithProviders(<Button label="Edit" size="sm" onPress={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Edit" }).props.hitSlop).toBe(4);
  });

  it.each([
    ["quiet", ["bg-surface-elevated", "border-input"]],
    ["outline", ["border-primary-muted"]],
    ["destructiveSubtle", ["bg-destructive-subtle", "border-destructive-border"]],
  ] as const)("renders the %s variant with semantic tokens", async (variant, classes) => {
    await renderWithProviders(<Button label="Act" variant={variant} onPress={jest.fn()} />);
    const button = screen.getByRole("button", { name: "Act" });
    for (const name of classes) expect(button.props.className).toContain(name);
  });
});

describe("Input and Textarea", () => {
  it("is labelled and announces validation errors", async () => {
    await renderWithProviders(<Input label="Email" error="Has invalid format" />);

    expect(screen.getByLabelText("Email")).toBeOnTheScreen();
    expect(screen.getByRole("alert")).toHaveTextContent("Has invalid format");
  });

  it("accepts typed text", async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(<Input label="Name" onChangeText={onChangeText} />);
    await userEvent.type(screen.getByLabelText("Name"), "Ali");
    expect(onChangeText).toHaveBeenLastCalledWith("Ali");
  });

  it("shows a unit inside the field and reads it with the hint", async () => {
    await renderWithProviders(<Input label="Weight" unit="kg" description="Optional" />);
    expect(screen.getByLabelText("Weight")).toHaveProp("accessibilityHint", "kg. Optional");
    // Visible, but not a separate element for assistive technology.
    expect(screen.queryByText("kg")).toBeNull();
    expect(screen.getByText("kg", { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it("renders a multiline text area", async () => {
    await renderWithProviders(<Textarea label="Notes" />);
    expect(screen.getByLabelText("Notes")).toHaveProp("multiline", true);
  });
});

describe("Checkbox", () => {
  it("toggles and reports its checked state", async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Checkbox label="Remember me" checked={false} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "Remember me" });
    expect(checkbox).not.toBeChecked();
    await userEvent.press(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("ignores presses when disabled", async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Checkbox label="Terms" checked disabled onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "Terms" });
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
    await userEvent.press(checkbox);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Switch", () => {
  it("is labelled and reports value changes", async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Switch label="Notifications" value={false} onChange={onChange} />);

    const toggle = screen.getByRole("switch", { name: "Notifications" });
    fireEvent(toggle, "valueChange", true);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("RadioGroup", () => {
  it("exposes a radiogroup with checked state", async () => {
    const onChange = jest.fn();
    await renderWithProviders(
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

describe("SegmentedControl", () => {
  it("is a tab list with one selected tab", async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <SegmentedControl
        label="Round"
        value="r1"
        onChange={onChange}
        segments={[
          { value: "r1", label: "Round 1" },
          { value: "r2", label: "Round 2" },
        ]}
      />,
    );

    // Container role (not focusable itself, so each tab stays reachable).
    expect(screen.getByLabelText("Round")).toHaveProp("accessibilityRole", "tablist");
    expect(screen.getByRole("tab", { name: "Round 1" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "Round 2" })).not.toBeSelected();
    await userEvent.press(screen.getByRole("tab", { name: "Round 2" }));
    expect(onChange).toHaveBeenCalledWith("r2");
  });
});

describe("Badge and Avatar", () => {
  it("states the badge label as text", async () => {
    await renderWithProviders(<Badge label="Online" variant="success" />);
    expect(screen.getByLabelText("Online")).toHaveProp("accessibilityRole", "text");
  });

  it("names the avatar after the person and shows initials", async () => {
    await renderWithProviders(<Avatar name="Ada Lovelace" />);
    expect(screen.getByRole("image", { name: "Ada Lovelace" })).toHaveTextContent("AL");
    expect(initialsOf("  cher ")).toBe("C");
  });
});

describe("Modal", () => {
  it("shows a titled dialog that closes from its close button", async () => {
    const onClose = jest.fn();
    await renderWithProviders(
      <Modal visible title="End session?" closeLabel="Close" onClose={onClose}>
        <Text>Body</Text>
      </Modal>,
    );

    expect(screen.getByRole("header", { name: "End session?" })).toBeOnTheScreen();
    // Backdrop and the X button both close; the X is the last one.
    const closers = screen.getAllByRole("button", { name: "Close" });
    await userEvent.press(closers[closers.length - 1]!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing while hidden", async () => {
    await renderWithProviders(
      <Modal visible={false} title="Hidden" closeLabel="Close" onClose={jest.fn()} />,
    );
    expect(screen.queryByText("Hidden")).toBeNull();
  });
});

describe("Toast", () => {
  function Trigger() {
    const toast = useToast();
    return (
      <Button label="Notify" onPress={() => toast.show({ title: "Saved", tone: "success" })} />
    );
  }

  it("announces the message and dismisses it automatically", async () => {
    jest.useFakeTimers();
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    try {
      await renderWithProviders(<Trigger />);
      await userEvent.press(screen.getByRole("button", { name: "Notify" }));

      expect(screen.getByRole("alert", { name: "Saved" })).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledWith("Saved");
      await act(() => jest.advanceTimersByTime(4000));
      expect(screen.queryByRole("alert", { name: "Saved" })).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("Loading", () => {
  it("announces the spinner and hides skeletons from assistive technology", async () => {
    await renderWithProviders(
      <>
        <Spinner label="Loading" />
        <Skeleton className="h-4" />
      </>,
    );
    expect(screen.getByRole("progressbar", { name: "Loading" })).toBeOnTheScreen();
  });
});
