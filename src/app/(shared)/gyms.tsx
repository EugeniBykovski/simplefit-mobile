import { GymChooser } from "@/features/session-gate";
import { SignOutButton } from "@/features/sign-out";
import { EntryFailure, LaunchScreen } from "@/widgets/system-states";

/** MGC1 (`mobile.gyms`, SF-89): the gym chooser where `gym_selection` lands. */
export default function GymsRoute() {
  return (
    <GymChooser
      pending={<LaunchScreen />}
      failure={<EntryFailure />}
      footer={<SignOutButton variant="ghost" />}
    />
  );
}
