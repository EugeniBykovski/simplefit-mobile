import { type Href, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useTranslations } from "use-intl";

import { GoogleSignInButton } from "@/features/sign-in-with-google";
import { siteConfig } from "@/shared/config/site";
import { Screen } from "@/shared/ui/screen";
import { Text } from "@/shared/ui/text";

/**
 * A01 Welcome and O01b Sign in, Google only (SF-22). The designed auth shell
 * with Apple, email and passkeys is built by SF-24.
 */
export function WelcomeScreen() {
  const t = useTranslations("auth.welcome");

  return (
    <Screen edges={["top", "bottom", "left", "right"]}>
      <View className="gap-4 pt-6">
        <Text variant="label" color="primary">
          {siteConfig.name}
        </Text>
        <Text variant="h1">{t("title")}</Text>
        <Text color="mutedForeground">{t("description")}</Text>
      </View>
      <GoogleSignInButton />
      <TextLink prompt={t("haveAccount")} label={t("signIn")} href="/login" />
    </Screen>
  );
}

export function LoginScreen() {
  const t = useTranslations("auth.login");

  return (
    <Screen>
      <View className="gap-2 pt-2">
        <Text variant="h1">{t("title")}</Text>
        <Text variant="bodySm" color="mutedForeground">
          {t("description")}
        </Text>
      </View>
      <GoogleSignInButton variant="quiet" />
      <TextLink prompt={t("newHere")} label={t("join")} href="/welcome" />
    </Screen>
  );
}

function TextLink({ prompt, label, href }: { prompt: string; label: string; href: Href }) {
  const router = useRouter();

  return (
    <View className="flex-row flex-wrap items-center justify-center gap-1">
      <Text variant="bodySm" color="mutedForeground">
        {prompt}
      </Text>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push(href)}
        className="min-h-touch justify-center px-1"
      >
        <Text variant="bodySm" weight="extrabold" color="highlight">
          {label}
        </Text>
      </Pressable>
    </View>
  );
}
