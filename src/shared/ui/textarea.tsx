import { Input, type InputProps } from "./input";

/** Multiline text field (notes, messages). Same API as Input. */
export function Textarea(props: Omit<InputProps, "multiline">) {
  return <Input multiline numberOfLines={4} {...props} />;
}
