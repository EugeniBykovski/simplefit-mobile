import { ContextSelection } from "@/features/session-gate";
import { SignOutButton } from "@/features/sign-out";
import { EntryFailure, LaunchScreen } from "@/widgets/system-states";

/** A04 (`mobile.workspaces`, SF-55): the context chooser where `context_selection` lands. */
export default function WorkspacesRoute() {
  return (
    <ContextSelection
      pending={<LaunchScreen />}
      failure={<EntryFailure />}
      footer={<SignOutButton variant="ghost" />}
    />
  );
}
