import {
  Building2,
  Flag,
  Hand,
  Lock,
  QrCode,
  Timer,
  User,
  type LucideIcon,
} from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTranslations } from "use-intl";

import { useTheme } from "@/shared/styles/theme";
import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";

/*
 * The FR1–FR3 illustrations (Claude Design 34a), drawn from the artboards'
 * geometry with tokens. They show what each part of SimpleFit is for, never
 * the person's data: names and counts are generic labels (SF-41 decision).
 * Each is one image for assistive technology, described in words.
 *
 * The artboards draw them on a 348 × 360 canvas; horizontal positions follow
 * the card's actual width (runtime values), the height stays 360.
 */

const CANVAS_WIDTH = 348;
const CANVAS_HEIGHT = 360;

/** The illustration card: 360 pt tall, radius 4xl, measured so positions follow its width. */
function ArtCard({
  description,
  children,
}: {
  description: string;
  children: (scale: (x: number) => number, width: number) => ReactNode;
}) {
  const [width, setWidth] = useState(CANVAS_WIDTH);
  const scale = (x: number) => (x * width) / CANVAS_WIDTH;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={description}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      className="overflow-hidden rounded-4xl border border-border bg-surface"
      // The artboards' 360 pt illustration canvas has no spacing step.
      style={{ height: CANVAS_HEIGHT }}
    >
      {children(scale, width)}
    </View>
  );
}

/** A positioned element of the canvas (runtime coordinates). */
function At({
  x,
  y,
  width,
  children,
  align = "left",
}: {
  x: number;
  y: number;
  width?: number;
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <View
      className={`absolute ${align === "right" ? "items-end" : "items-start"}`}
      // Runtime position on the measured canvas.
      style={{ left: x, top: y, width }}
    >
      {children}
    </View>
  );
}

function NodeCaption({ title, note }: { title: string; note: string }) {
  return (
    <View className="gap-px">
      <Text variant="micro" weight="bold">
        {title}
      </Text>
      <Text variant="micro" color="faintForeground">
        {note}
      </Text>
    </View>
  );
}

function Badge({ children, tone = "accent" }: { children: string; tone?: "accent" | "muted" }) {
  return (
    <Text
      variant="badge"
      color={tone === "accent" ? "accentForeground" : "mutedForeground"}
      className={`rounded-sm px-2.5 py-1 ${tone === "accent" ? "bg-accent" : "bg-muted"}`}
    >
      {children}
    </Text>
  );
}

function RoundNode({
  icon,
  size,
  tone,
}: {
  icon: LucideIcon;
  size: "lg" | "md" | "sm";
  tone: "primary" | "person" | "session" | "highlight";
}) {
  const box = {
    lg: "size-16 rounded-2xl",
    md: "size-10 rounded-full",
    sm: "size-8 rounded-full",
  }[size];
  const fill = {
    primary: "bg-primary border-primary",
    person: "bg-input border-accent-border",
    session: "bg-muted border-accent-border",
    highlight: "bg-highlight border-highlight rounded-md",
  }[tone];
  const color =
    tone === "primary" || tone === "highlight"
      ? "primaryForeground"
      : tone === "person"
        ? "foreground"
        : "highlight";
  return (
    <View className={`items-center justify-center border-[1.5px] ${box} ${fill}`}>
      <Icon icon={icon} size={size === "lg" ? 24 : 15} color={color} />
    </View>
  );
}

/** FR1 · Live Board: you at the centre, a gym, partners and sessions around. */
export function BoardArt() {
  const t = useTranslations("firstRunIntro.board.art");
  const { colors } = useTheme();
  return (
    <ArtCard description={t("description")}>
      {(x, width) => (
        <>
          <Svg width={width} height={360} className="absolute">
            {Array.from({ length: 16 }, (_, column) =>
              Array.from({ length: 16 }, (__, row) => (
                <Circle
                  key={`${column}-${row}`}
                  cx={x(14 + column * 22)}
                  cy={14 + row * 22}
                  r={1}
                  fill={colors.input}
                />
              )),
            )}
            <Path
              d={`M${x(174)} 170 L${x(86)} 96 M${x(174)} 170 L${x(268)} 92 M${x(174)} 170 L${x(92)} 262 M${x(174)} 170 L${x(262)} 252`}
              stroke={colors.accentBorder}
              strokeWidth={2}
              fill="none"
            />
            <Path
              d={`M${x(174)} 170 L${x(174)} 300`}
              stroke={colors.primaryMuted}
              strokeWidth={2}
              strokeDasharray="5 6"
              fill="none"
            />
          </Svg>
          <At x={x(142)} y={138}>
            <RoundNode icon={Building2} size="lg" tone="primary" />
          </At>
          <At x={x(66)} y={76}>
            <RoundNode icon={User} size="md" tone="person" />
          </At>
          <At x={x(248)} y={72}>
            <RoundNode icon={User} size="md" tone="person" />
          </At>
          <At x={x(77)} y={247}>
            <RoundNode icon={Timer} size="sm" tone="session" />
          </At>
          <At x={x(247)} y={237}>
            <RoundNode icon={Hand} size="sm" tone="session" />
          </At>
          <At x={x(157)} y={283}>
            <View className="size-8 items-center justify-center rounded-md bg-highlight">
              <Icon icon={Flag} size={15} color="primaryForeground" />
            </View>
          </At>
          <At x={x(214)} y={162} width={x(130)}>
            <NodeCaption title={t("gym")} note={t("gymNote")} />
          </At>
          <At x={x(22)} y={34} width={x(140)}>
            <NodeCaption title={t("partner")} note={t("partnerNote")} />
          </At>
          <At x={x(196)} y={34} width={x(130)} align="right">
            <NodeCaption title={t("roadwork")} note={t("roadworkNote")} />
          </At>
          <At x={x(18)} y={284} width={x(130)}>
            <NodeCaption title={t("technical")} note={t("technicalNote")} />
          </At>
          <At x={x(214)} y={232} width={x(120)} align="right">
            <NodeCaption title={t("sparring")} note={t("sparringNote")} />
          </At>
          <At x={x(198)} y={302} width={x(140)}>
            <NodeCaption title={t("fight")} note={t("fightNote")} />
          </At>
          <At x={16} y={16}>
            <Badge>{t("private")}</Badge>
          </At>
        </>
      )}
    </ArtCard>
  );
}

/** FR2 · Round timer: the round ring, the time, the rounds bar and the journal note. */
export function TimerArt() {
  const t = useTranslations("firstRunIntro.timer.art");
  const { colors } = useTheme();
  const centre = (width: number) => width / 2;
  return (
    <ArtCard description={t("description")}>
      {(_x, width) => (
        <>
          <Svg width={width} height={360} className="absolute">
            <Circle
              cx={centre(width)}
              cy={160}
              r={104}
              fill="none"
              stroke={colors.border}
              strokeWidth={12}
            />
            <Circle
              cx={centre(width)}
              cy={160}
              r={104}
              fill="none"
              stroke={colors.primary}
              strokeWidth={12}
              strokeDasharray="405.1 653.5"
              strokeLinecap="round"
              transform={`rotate(-90 ${centre(width)} 160)`}
            />
            <Circle
              cx={centre(width)}
              cy={160}
              r={84}
              fill="none"
              stroke={colors.muted}
              strokeWidth={5}
            />
            <Circle
              cx={centre(width)}
              cy={160}
              r={84}
              fill="none"
              stroke={colors.accentForeground}
              strokeWidth={5}
              strokeDasharray="221.7 527.8"
              strokeLinecap="round"
              transform={`rotate(-90 ${centre(width)} 160)`}
            />
          </Svg>
          <View className="absolute inset-x-0 top-28 items-center gap-1">
            <Text variant="label" color="highlight">
              {t("round")}
            </Text>
            <Text variant="display" weight="bold">
              {t("time")}
            </Text>
            <Text variant="label" color="faintForeground">
              {t("rest")}
            </Text>
          </View>
          <View className="absolute inset-x-6 bottom-14 flex-row gap-1">
            {[
              "bg-primary",
              "bg-primary",
              "bg-accent-foreground",
              "bg-input",
              "bg-input",
              "bg-input",
            ].map((fill, index) => (
              <View key={index} className={`h-2 flex-1 rounded-xs ${fill}`} />
            ))}
          </View>
          <View className="absolute inset-x-6 bottom-5 flex-row items-center justify-between gap-3">
            <Text variant="caption" weight="extrabold" className="flex-1">
              {t("log")}
            </Text>
            <Badge>{t("badge")}</Badge>
          </View>
        </>
      )}
    </ArtCard>
  );
}

/** FR3 · Coach & gym: a plan from your coach, a booked class, a partner's message, privacy. */
export function CornerArt() {
  const t = useTranslations("firstRunIntro.coach.art");
  return (
    <ArtCard description={t("description")}>
      {() => (
        <>
          <View className="absolute inset-x-5 top-5.5 flex-row items-center gap-3 rounded-2xl border border-input bg-background p-3.5">
            <View className="size-10 items-center justify-center rounded-full bg-input">
              <Text variant="caption" weight="bold" className="font-display-bold">
                {t("coachInitials")}
              </Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="bodySm" weight="extrabold">
                {t("coach")}
              </Text>
              <Text variant="caption" color="mutedForeground">
                {t("coachNote")}
              </Text>
            </View>
            <Badge>{t("new")}</Badge>
          </View>
          <View className="absolute inset-x-8 top-28 flex-row items-center justify-between rounded-2xl bg-primary px-4 py-3.5">
            <View className="gap-0.5">
              <Text variant="label" className="text-accent-strong">
                {t("classLabel")}
              </Text>
              <Text variant="metricXl" color="primaryForeground">
                {t("classTime")}
              </Text>
              <Text variant="caption" weight="extrabold" color="primaryForeground">
                {t("className")}
              </Text>
            </View>
            <Icon icon={QrCode} size={30} color="primaryForeground" />
          </View>
          <View className="absolute inset-x-5 top-56 flex-row items-center gap-2.5 rounded-2xl border border-input bg-background px-3.5 py-3">
            <View className="size-8 items-center justify-center rounded-full bg-input">
              <Text variant="micro" weight="bold" className="font-display-bold">
                {t("partnerInitials")}
              </Text>
            </View>
            <Text variant="caption" color="mutedForeground" className="flex-1">
              <Text variant="caption" weight="bold">
                {t("partner")}
              </Text>
              {" · "}
              {t("partnerNote")}
            </Text>
          </View>
          <View className="absolute inset-x-5 bottom-4.5 flex-row items-start gap-2.5 rounded-lg border border-accent-border bg-accent px-3.5 py-3">
            <Icon icon={Lock} size={16} color="highlight" />
            <Text variant="micro" color="accentForeground" className="flex-1">
              {t("private")}
            </Text>
          </View>
        </>
      )}
    </ArtCard>
  );
}
