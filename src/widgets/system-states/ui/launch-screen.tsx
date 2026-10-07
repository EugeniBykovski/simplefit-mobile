import Constants from "expo-constants";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { useTheme } from "@/shared/styles/theme";
import { Text } from "@/shared/ui/text";

import { BrandLoader } from "./brand-loader";
import { CornerTip } from "./corner-tip";
import { LoadingSegments } from "./loading-indicators";
import { SystemGlow } from "./system-glow";

/**
 * LD1 · App launch (Claude Design section 35): the cold-start state while the
 * session is restored before a signed-in route renders. The shell layouts
 * show it as SessionGate's pending cover, so it appears only while that real
 * work runs (fonts and locale stay on the native splash). No minimum
 * duration, indeterminate progress.
 *
 * The footer shows only the real app version; the artboard's region and
 * "offline-ready" labels are not runtime facts and are omitted (SF-34
 * decision 2).
 */
export function LaunchScreen() {
  const t = useTranslations("system.launch");
  const { colors } = useTheme();
  const version = Constants.expoConfig?.version;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("label")}
      accessibilityState={{ busy: true }}
      className="flex-1 bg-background"
    >
      <SystemGlow color={colors.accent} cy="40%" />
      <View className="absolute inset-x-0 top-[23.7%]">
        <BrandLoader />
      </View>
      <View className="absolute inset-x-6 bottom-10 items-center gap-3.5">
        <Text weight="extrabold" className="self-start">
          {t("status")}
        </Text>
        <LoadingSegments count={6} />
        <CornerTip label={t("tipLabel")} tip={t("tip")} />
        {version ? (
          <Text variant="label" color="faintForeground">
            {t("version", { version })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
