import {
  Activity,
  Calendar,
  House,
  IdCard,
  MessageSquare,
  ScanLine,
  SlidersHorizontal,
  Ticket,
  Timer,
  User,
  Users,
  Waypoints,
  type LucideIcon,
} from "lucide-react-native";

import type { MobileRouteId, MobileShellId } from "@/shared/routes/routes";

export type TabShell = "fighter" | "coach" | "gym";

/** A tab of a production bar that differs from the registry `navItems`; no route: shown as Soon. */
export type TabItemConfig = { key: string; route?: MobileRouteId };

/**
 * What the registry does not hold about a tab bar, from its Claude Design
 * component (FighterTabs, CoachTabs, GymTabs): the icon of each item and the
 * raised centre action. Items, order and targets come from the registry's
 * `navItems`; labels from the `shells.<shell>` messages.
 */
export const tabNavigation: Record<
  TabShell,
  {
    shell: MobileShellId;
    icons: Record<string, LucideIcon>;
    center?: string;
    /**
     * The production bar when it is smaller than the registry's `navItems`
     * (the Route Gallery's full navigation keeps its placeholder routes). An
     * item without a route belongs to a domain that does not exist yet: a
     * labelled, disabled "Soon" button, never a link to a placeholder.
     */
    items?: readonly TabItemConfig[];
  }
> = {
  fighter: {
    shell: "mobile.fighter",
    icons: { home: House, training: Timer, board: Waypoints, community: Users, profile: User },
    center: "board",
  },
  // The Coach MVP (Claude Design CoachTabs, version 1791994719-673f, SF-55;
  // Fighters live since SF-61, 1792155768-3179): Today, Fighters, Sessions
  // marked Soon (no session domain yet), and Settings (the shared ST1, pushed
  // above the tabs). The registry
  // keeps the Route Gallery's items and their placeholder routes
  // (D-MOBILE-COACH-SHELL-MVP).
  coach: {
    shell: "mobile.coach",
    icons: {
      today: House,
      fighters: Users,
      sessions: Calendar,
      settings: SlidersHorizontal,
      board: Waypoints,
      requests: Ticket,
      inbox: MessageSquare,
    },
    items: [
      { key: "today", route: "mobile.coach.today" },
      { key: "fighters", route: "mobile.coach.fighters" },
      { key: "sessions" },
      { key: "settings", route: "mobile.settings" },
    ],
  },
  gym: {
    shell: "mobile.gym",
    icons: { pulse: Activity, classes: Calendar, checkin: ScanLine, members: Users, staff: IdCard },
    center: "checkin",
  },
};
