import { useTranslations } from "use-intl";

import type { TabShell } from "./navigation";

/**
 * The label of a shell's tab from its route group (`(training)` → "Training"):
 * the title of the shell's `(tabs)` screen, which a screen pushed above the
 * tabs (FT2 from Home or Training) announces on its native back button.
 * Without it iOS reads the route group's name, "(tabs)".
 */
export function useTabTitle(shell: TabShell) {
  const t = useTranslations("shells");
  return (routeName: string) =>
    t(`${shell}.${routeName.replace(/^\(|\)$/g, "")}` as Parameters<typeof t>[0]);
}
