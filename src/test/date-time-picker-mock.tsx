import { View } from "react-native";

/**
 * Jest stand-in for `@react-native-community/datetimepicker` (SF-65): the
 * iOS picker renders as a view carrying its props (a test reads `value` and
 * calls `onValueChange`); the Android dialog is `DateTimePickerAndroid.open`,
 * a mock a test can inspect and answer.
 */
export default function DateTimePicker(props: Record<string, unknown>) {
  return <View testID="native-date-time-picker" {...props} />;
}

export const DateTimePickerAndroid = { open: jest.fn(), dismiss: jest.fn() };
