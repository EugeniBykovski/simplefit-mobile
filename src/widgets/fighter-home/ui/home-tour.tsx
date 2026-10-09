import { Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, View, type LayoutRectangle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";

import { themeVariables } from "@/shared/styles/tokens";
import { useTheme } from "@/shared/styles/theme";
import { Icon } from "@/shared/ui/icon";
import { Spotlight, useSpotlightTargets } from "@/shared/ui/spotlight";
import { Text } from "@/shared/ui/text";

import { TOUR_LENGTH, TOUR_STEPS } from "../model/tour";

/**
 * FR5 (Claude Design 34a): the seven-step tour of the Fighter home and tab
 * bar, then its completion card. Each step measures its real target when it
 * shows. The card is the bone coach mark (the opposite theme's tokens, scoped
 * to the card, as the web FRW2). Help, not onboarding: it records nothing,
 * and Help (?) replays it. Mounted only while open, so every opening starts
 * at step 1.
 */
export function HomeTour({ onClose }: { onClose: () => void }) {
  const t = useTranslations("fighterHome.tour");
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { measure } = useSpotlightTargets();
  const [index, setIndex] = useState(0);
  const [measured, setMeasured] = useState<{ id: string; rect: LayoutRectangle | undefined }>();
  const [cardHeight, setCardHeight] = useState(0);
  const step = TOUR_STEPS[index] ?? TOUR_STEPS[0]!;
  const done = step.id === "done";
  // A rectangle measured for an earlier step is never shown for this one.
  const target = measured?.id === step.target ? measured.rect : undefined;

  useEffect(() => {
    let current = true;
    void measure(step.target).then((rect) => {
      if (current) setMeasured({ id: step.target, rect });
    });
    return () => {
      current = false;
    };
  }, [step.target, measure]);

  const card = (
    <View
      accessibilityRole="none"
      onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
      className="gap-2.5 rounded-3xl bg-background p-4.5"
      // The opposite theme's tokens, scoped to the card (bone on graphite).
      style={themeVariables(scheme === "dark" ? "light" : "dark")}
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="label" color="primary">
          {done ? t("doneLabel") : t("label", { step: index + 1, total: TOUR_LENGTH })}
        </Text>
        {done ? (
          <View className="size-5.5 items-center justify-center rounded-full bg-primary">
            <Icon icon={Check} size={13} color="foreground" />
          </View>
        ) : (
          <View className="flex-row gap-0.5" importantForAccessibility="no-hide-descendants">
            {Array.from({ length: TOUR_LENGTH }, (_, position) => (
              <View
                key={position}
                className={`h-1 w-3 rounded-full ${position <= index ? "bg-primary" : "bg-border-strong"}`}
              />
            ))}
          </View>
        )}
      </View>
      <Text variant="h3" accessibilityRole="header">
        {t(`steps.${step.id}.title`)}
      </Text>
      <Text variant="bodySm" color="mutedForeground">
        {t(`steps.${step.id}.body`)}
      </Text>
      <View className="mt-1 flex-row items-center justify-between gap-3">
        {done ? (
          <View />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("end")}
            onPress={onClose}
            hitSlop={8}
            className="min-h-touch justify-center"
          >
            <Text variant="bodySm" weight="extrabold" color="mutedForeground">
              {t("end")}
            </Text>
          </Pressable>
        )}
        <View className="flex-row gap-2">
          {index > 0 && !done ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("back")}
              onPress={() => setIndex(index - 1)}
              className="h-11 justify-center rounded-md-lg border border-input px-4"
            >
              <Text variant="bodySm" weight="extrabold">
                {t("back")}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              done ? t("close") : index === TOUR_LENGTH - 1 ? t("finish") : t("next")
            }
            onPress={() => (done ? onClose() : setIndex(index + 1))}
            className="h-11 justify-center rounded-md-lg bg-foreground px-4.5"
          >
            <Text variant="bodySm" weight="extrabold" color="secondaryForeground">
              {done ? t("close") : index === TOUR_LENGTH - 1 ? t("finish") : t("next")}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <Spotlight
      visible
      target={target}
      padding={step.padding}
      radius={step.radius}
      insets={{ top: insets.top, bottom: insets.bottom }}
      card={card}
      cardHeight={cardHeight}
      onRequestClose={onClose}
    />
  );
}
