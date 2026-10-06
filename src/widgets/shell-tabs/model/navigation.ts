import {
  Activity,
  Calendar,
  House,
  IdCard,
  MessageSquare,
  ScanLine,
  Ticket,
  Timer,
  User,
  Users,
  Waypoints,
  type LucideIcon,
} from "lucide-react-native";

import type { MobileShellId } from "@/shared/routes/routes";

export type TabShell = "fighter" | "coach" | "gym";

/**
 * What the registry does not hold about a tab bar, from its Claude Design
 * component (FighterTabs, CoachTabs, GymTabs): the icon of each item and the
 * raised centre action. Items, order and targets come from the registry's
 * `navItems`; labels from the `shells.<shell>` messages.
 */
export const tabNavigation: Record<
  TabShell,
  { shell: MobileShellId; icons: Record<string, LucideIcon>; center?: string }
> = {
  fighter: {
    shell: "mobile.fighter",
    icons: { home: House, training: Timer, board: Waypoints, community: Users, profile: User },
    center: "board",
  },
  coach: {
    shell: "mobile.coach",
    icons: {
      today: House,
      fighters: Users,
      board: Waypoints,
      requests: Ticket,
      inbox: MessageSquare,
    },
  },
  gym: {
    shell: "mobile.gym",
    icons: { pulse: Activity, classes: Calendar, checkin: ScanLine, members: Users, staff: IdCard },
    center: "checkin",
  },
};
