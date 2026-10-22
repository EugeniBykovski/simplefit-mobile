import { useNavigation, useRouter } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Keyboard, Platform, ScrollView, useWindowDimensions, View } from "react-native";
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

/**
 * How much of this view the iOS keyboard covers. The keyboard's height (not
 * its reported position, which iOS re-sends wrongly when the app returns to
 * the foreground with the keyboard up) minus the gap between this view and
 * the bottom of the window (the tab bar under a pushed screen). Android
 * resizes the window for the keyboard itself.
 */
function useKeyboardOverlap(view: React.RefObject<View | null>): number {
  const [overlap, setOverlap] = useState(0);
  const window = useWindowDimensions();
  const windowHeight = useRef(window.height);
  useEffect(() => {
    windowHeight.current = window.height;
  }, [window.height]);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const show = Keyboard.addListener("keyboardWillShow", (event) => {
      view.current?.measureInWindow((_x, y, _width, height) => {
        const gap = windowHeight.current - (y + height);
        setOverlap(Math.max(event.endCoordinates.height - gap, 0));
      });
    });
    const hide = Keyboard.addListener("keyboardWillHide", () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [view]);
  return overlap;
}

/** Body above the keyboard, the actions pinned over the home indicator or the keyboard. */
function Frame({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const frame = useRef<View>(null);
  const keyboard = useKeyboardOverlap(frame);
  return (
    <View
      ref={frame}
      className="flex-1 bg-background"
      // Runtime: the part of the screen the keyboard covers.
      style={{ paddingBottom: keyboard }}
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
        // Runtime inset: the artboard keeps the actions 34 pt above the bottom
        // edge; above the keyboard, the usual 16 pt.
        style={{ paddingBottom: keyboard > 0 ? 16 : Math.max(insets.bottom, 16) }}
      >
        {actions}
      </View>
    </View>
  );
}
