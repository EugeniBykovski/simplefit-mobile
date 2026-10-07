import { usePathname, useRouter } from "expo-router";
import {
  ChevronLeft,
  CircleHelp,
  RotateCw,
  Search,
  Timer,
  type LucideIcon,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";

import { routeHref } from "@/shared/routes/routes";
import { useTheme } from "@/shared/styles/theme";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";

import { KNOCKOUT, useRefereeCount, type RefereePhase } from "../model/referee-count";
import { SystemGlow } from "./system-glow";

/**
 * ER1 · Mobile 404 (Claude Design section 35): the referee count, then a
 * knockout or "saved by the bell". Every action opens a registry route
 * (`/`, the entry that resolves the user's destination, never fighter-only
 * `/home`; `/settings/help`; `/search`) or goes back. The count is local
 * presentation state; `initialPhase` and `frozen` exist for deterministic
 * tests, production passes neither.
 */
export function NotFoundState({
  initialPhase,
  frozen,
}: {
  initialPhase?: RefereePhase;
  frozen?: boolean;
}) {
  const t = useTranslations("system.notFound");
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const referee = useRefereeCount({ initialPhase, frozen });
  const { phase, count } = referee;

  const home = () => router.replace(routeHref("mobile.root"));
  const back = () => (router.canGoBack() ? router.back() : home());
  const help = () => router.push(routeHref("mobile.settings.help"));

  return (
    <View className="flex-1 bg-background">
      <SystemGlow color={colors.accent} cy="30%" />
      <View
        className="flex-1 justify-between px-5"
        // Runtime insets: the header clears the status bar, the actions the home indicator.
        style={{ paddingTop: insets.top + 14, paddingBottom: Math.max(insets.bottom, 30) }}
      >
        <View className="gap-5.5">
          <View className="flex-row items-center justify-between">
            <RoundButton label={t("back")} icon={ChevronLeft} onPress={back} />
            <Text variant="labelLg" color="faintForeground">
              {t("errorCode")}
            </Text>
            <RoundButton label={t("help")} icon={CircleHelp} onPress={help} />
          </View>

          <View className="size-[300px] items-center justify-center self-center">
            <Ring colors={colors} />
            <RefereeCount phase={phase} count={count} />
          </View>

          <View accessibilityLiveRegion="polite" className="gap-2.5">
            <Text variant="labelLg" color="highlight">
              {t(`${phase}.kicker`)}
            </Text>
            <Text variant="hero">{t(`${phase}.title`)}</Text>
            <Text color="mutedForeground">{t(`${phase}.description`)}</Text>
          </View>
        </View>

        <View className="gap-3">
          <View className="flex-row gap-2.5">
            {phase === "count" ? (
              <>
                <Grow>
                  <Button size="lg" icon={Timer} label={t("count.beat")} onPress={referee.beat} />
                </Grow>
                <Grow>
                  <Button size="lg" variant="quiet" label={t("count.home")} onPress={home} />
                </Grow>
              </>
            ) : phase === "ko" ? (
              <>
                <Grow>
                  <Button size="lg" label={t("ko.corner")} onPress={home} />
                </Grow>
                <Grow>
                  <Button
                    size="lg"
                    variant="quiet"
                    icon={RotateCw}
                    label={t("ko.again")}
                    onPress={referee.again}
                  />
                </Grow>
              </>
            ) : (
              <>
                <Grow>
                  <Button size="lg" label={t("saved.corner")} onPress={home} />
                </Grow>
                <Grow>
                  <Button
                    size="lg"
                    variant="quiet"
                    icon={Search}
                    label={t("saved.search")}
                    onPress={() => router.push(routeHref("mobile.search"))}
                  />
                </Grow>
              </>
            )}
          </View>
          <View className="flex-row items-center justify-between gap-3">
            <Text variant="micro" color="faintForeground" numberOfLines={1} className="flex-1">
              {t("pathNotFound", { path: pathname })}
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={help}
              className="min-h-touch justify-center"
            >
              <Text variant="caption" weight="extrabold" color="faintForeground">
                {t("report")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function Grow({ children }: { children: ReactNode }) {
  return <View className="flex-1">{children}</View>;
}

function RoundButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="size-11 items-center justify-center rounded-full border border-border bg-surface"
    >
      <Icon icon={icon} />
    </Pressable>
  );
}

/** The count, knockout or saved centre of the ring, and the ten count ticks. */
function RefereeCount({ phase, count }: { phase: RefereePhase; count: number }) {
  const t = useTranslations("system.notFound");
  const { colors } = useTheme();
  const ticks = (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      className="flex-row gap-1"
    >
      {Array.from({ length: KNOCKOUT }, (_, index) => (
        <View
          key={index}
          className={`h-1.5 w-2 rounded-full ${
            index < count ? (phase === "ko" ? "bg-destructive" : "bg-highlight") : "bg-input"
          }`}
        />
      ))}
    </View>
  );

  if (phase === "saved") {
    return (
      <View className="items-center gap-2.5">
        <Svg width={112} height={112} viewBox="0 0 200 200">
          <Rect width="200" height="200" rx="66" fill={colors.primary} />
          <Path
            d="M70.8 102.1 89.6 120.8 129.2 81.3"
            fill="none"
            stroke={colors.primaryForeground}
            strokeWidth={12.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text variant="labelLg" color="highlight">
          {t("saved.tag", { count })}
        </Text>
      </View>
    );
  }

  if (phase === "ko") {
    return (
      <View className="items-center gap-2.5">
        <Text variant="numeralKo">404</Text>
        <View className="rounded-sm bg-destructive-subtle px-2.5 py-1.5">
          <Text variant="labelLg" color="destructiveSubtleForeground">
            {t("ko.tag")}
          </Text>
        </View>
        {ticks}
      </View>
    );
  }

  return (
    <View className="items-center gap-1.5">
      <Text variant="labelLg" color="faintForeground">
        {t("refCount")}
      </Text>
      <Text variant="numeral">{String(count)}</Text>
      <Text variant="labelLg" color="highlight">
        {t(`words.${count}` as "words.1")}
      </Text>
      {ticks}
    </View>
  );
}

/** The ring of ER1: a canvas square inside two ropes, with four olive corner posts. */
function Ring({ colors }: { colors: ReturnType<typeof useTheme>["colors"] }) {
  const posts = [
    [22, 22],
    [278, 22],
    [22, 278],
    [278, 278],
  ];
  return (
    <View pointerEvents="none" className="absolute inset-0">
      <Svg width="100%" height="100%" viewBox="0 0 300 300">
        <Rect x="34" y="34" width="232" height="232" rx="26" fill={colors.surfaceSubtle} />
        <Rect
          x="18"
          y="18"
          width="264"
          height="264"
          rx="34"
          stroke={colors.borderStrong}
          strokeWidth={3}
          fill="none"
        />
        <Rect
          x="34"
          y="34"
          width="232"
          height="232"
          rx="28"
          stroke={colors.input}
          strokeWidth={2.5}
          fill="none"
        />
        <Rect
          x="50"
          y="50"
          width="200"
          height="200"
          rx="22"
          stroke={colors.border}
          strokeWidth={2}
          fill="none"
        />
        {posts.map(([cx, cy]) => (
          <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={11} fill={colors.highlight} />
        ))}
        {posts.map(([cx, cy]) => (
          <Circle key={`d${cx}-${cy}`} cx={cx} cy={cy} r={4.5} fill={colors.accent} />
        ))}
      </Svg>
    </View>
  );
}
