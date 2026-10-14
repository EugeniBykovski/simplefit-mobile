import { Text } from "./text";

/** A validation message, announced when it appears. */
export function FieldError({ message }: { message: string }) {
  return (
    <Text
      variant="caption"
      color="destructive"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {message}
    </Text>
  );
}
