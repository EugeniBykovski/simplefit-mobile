import { createContext, useContext } from "react";

/**
 * Called when a step field gains focus, so the screen can keep it visible
 * above the keyboard (iOS raises no keyboard event when focus moves between
 * fields while the keyboard is already up).
 */
export const FieldFocus = createContext<(() => void) | undefined>(undefined);

export const useFieldFocus = () => useContext(FieldFocus);
