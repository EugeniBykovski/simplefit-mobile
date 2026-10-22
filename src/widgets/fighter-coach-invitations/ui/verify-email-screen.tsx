import { useNavigation, useRouter } from "expo-router";
import { useLayoutEffect } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";

import { signOut } from "@/entities/session";
import { EmailIdentityLinkFlow, type LinkLayout } from "@/features/email-identity-link";
import { routeHref } from "@/shared/routes/routes";

/*
 * FCI3 Verify an email (`mobile.profile.coaches.invitations.verify-email`,
 * SF-79; Claude Design FighterCoaches `screen=verify`, version
 * 1792675284-1046), pushed from FCI1's "Missing an invitation?".
 *
 * The signed-in fighter adds an email identity to this same account with an
 * SF-77 code. Nothing else happens here: back on FCI1 the inbox is read
 * again, and an invitation to the address is opened and answered there
 * explicitly (FCI2). No token, address or code is ever in the route.
 */
export function VerifyEmailScreen() {
  const titles = useTranslations("routes.titles");
  const navigation = useNavigation();
  const router = useRouter();
  const title = titles("mobile/profile/coaches/invitations/verify-email");

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const backToInvitations = () => {
    if (router.canGoBack()) router.back();
    else router.replace(routeHref("mobile.profile.coaches.invitations"));
  };

  return (
    <EmailIdentityLinkFlow
      layout={layout}
      onDone={backToInvitations}
      onCancel={backToInvitations}
      onSwitchAccount={() => void signOut()}
      onSignIn={() => router.replace(routeHref("mobile.login"))}
    />
  );
}

const layout: LinkLayout = ({ body, actions }) => <Frame actions={actions}>{body}</Frame>;

/** Body above the keyboard, the actions pinned over the home indicator. */
function Frame({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      // Runtime: the opaque iOS navigation bar (44 pt) under the status bar.
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
      className="flex-1 bg-background"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="grow gap-4 px-5 pb-6 pt-4"
      >
        {children}
      </ScrollView>
      <View
        className="gap-2.5 px-5 pt-3"
        // Runtime inset: the artboard keeps the actions 34 pt above the bottom edge.
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        {actions}
      </View>
    </KeyboardAvoidingView>
  );
}
