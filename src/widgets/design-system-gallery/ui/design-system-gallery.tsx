import { Bell, Dumbbell, Plus, Timer } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { View } from "react-native";

import { ThemeSelector } from "@/features/switch-theme";
import { useTheme } from "@/shared/styles/theme";
import { rawPalette, type SemanticColors } from "@/shared/styles/tokens";
import { Avatar } from "@/shared/ui/avatar";
import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { Button, type ButtonVariant } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Icon } from "@/shared/ui/icon";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { RadioGroup } from "@/shared/ui/radio-group";
import { Screen } from "@/shared/ui/screen";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { Separator } from "@/shared/ui/separator";
import { Skeleton } from "@/shared/ui/skeleton";
import { Spinner } from "@/shared/ui/spinner";
import { Switch } from "@/shared/ui/switch";
import { Text, type TextVariant } from "@/shared/ui/text";
import { Textarea } from "@/shared/ui/textarea";
import { useToast } from "@/shared/ui/toast";

// Developer-facing reference screen (never shipped: the route is __DEV__-only),
// so its sample copy is intentionally English and not translated.

const typeScale: [TextVariant, string][] = [
  ["display", "18:00"],
  ["h1", "Create your account"],
  ["h2", "Gym dashboard"],
  ["h3", "Upgrade to Coach Pro"],
  ["title", "Next session"],
  ["metricXl", "€29.99"],
  ["metricLg", "142"],
  ["metric", "1h 34m"],
  ["metricSm", "22 rounds"],
  ["bodyLg", "Body large · field values"],
  ["body", "Body · mobile copy"],
  ["bodySm", "Body small · dense copy"],
  ["caption", "Caption · Arrive 17:50"],
  ["micro", "Micro · 2 min ago"],
  ["badge", "Badge · past due"],
  ["labelLg", "Label large · week 1"],
  ["label", "Label · or email"],
];
const buttonVariants: ButtonVariant[] = [
  "primary",
  "secondary",
  "quiet",
  "outline",
  "ghost",
  "destructive",
  "destructiveSubtle",
];
const badgeVariants: BadgeVariant[] = [
  "neutral",
  "primary",
  "accent",
  "success",
  "warning",
  "destructive",
  "info",
];
const swatches: (keyof SemanticColors)[] = [
  "background",
  "surface",
  "surfaceSubtle",
  "surfaceElevated",
  "muted",
  "border",
  "borderStrong",
  "input",
  "primary",
  "primaryMuted",
  "secondary",
  "highlight",
  "accent",
  "accentStrong",
  "accentBorder",
  "destructive",
  "destructiveSubtle",
  "success",
  "warning",
  "warningSubtle",
  "info",
  "ring",
];
// Literal class names so Tailwind generates them.
const spacing = [
  ["0.5", "w-0.5"],
  ["1", "w-1"],
  ["1.5", "w-1.5"],
  ["2", "w-2"],
  ["2.5", "w-2.5"],
  ["3", "w-3"],
  ["3.5", "w-3.5"],
  ["4", "w-4"],
  ["4.5", "w-4.5"],
  ["5", "w-5"],
  ["5.5", "w-5.5"],
  ["6", "w-6"],
  ["8", "w-8"],
  ["10", "w-10"],
  ["12", "w-12"],
  ["14", "w-14"],
  ["16", "w-16"],
  ["20", "w-20"],
] as const;
const radii = [
  ["xs", "rounded-xs"],
  ["sm", "rounded-sm"],
  ["md", "rounded-md"],
  ["lg", "rounded-lg"],
  ["xl", "rounded-xl"],
  ["2xl", "rounded-2xl"],
  ["3xl", "rounded-3xl"],
  ["4xl", "rounded-4xl"],
  ["full", "rounded-full"],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Text variant="label" color="faintForeground">
        {title}
      </Text>
      {children}
    </View>
  );
}

export function DesignSystemGallery() {
  const { colors, scheme } = useTheme();
  const toast = useToast();
  const [checked, setChecked] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [round, setRound] = useState<"r1" | "r2" | "r3">("r1");
  const [stance, setStance] = useState<"orthodox" | "southpaw">("orthodox");
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <Screen>
      <View className="gap-1">
        <Text variant="h2">Design system</Text>
        <Text color="mutedForeground">Graphite × Olive — {scheme} theme</Text>
      </View>

      <Card>
        <ThemeSelector />
      </Card>

      <Section title="Typography">
        {typeScale.map(([variant, sample]) => (
          <View key={variant} className="gap-0.5">
            <Text variant="micro" color="faintForeground">
              {variant}
            </Text>
            <Text variant={variant}>{sample}</Text>
          </View>
        ))}
        <Text variant="bodySm" color="mutedForeground">
          Weights:{" "}
          <Text variant="bodySm" weight="semibold">
            600 values
          </Text>{" "}
          ·{" "}
          <Text variant="bodySm" weight="bold">
            700 labels
          </Text>{" "}
          ·{" "}
          <Text variant="bodySm" weight="extrabold">
            800 emphasis
          </Text>
        </Text>
      </Section>

      <Section title="Semantic colours">
        <View className="flex-row flex-wrap gap-3">
          {swatches.map((token) => (
            <View key={token} className="w-24 gap-1">
              {/* Runtime token value: the colour being documented. */}
              <View
                className="h-12 rounded-md border border-border"
                style={{ backgroundColor: colors[token] }}
              />
              <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                {token}
              </Text>
            </View>
          ))}
        </View>
        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          <Text color="mutedForeground">muted</Text>
          <Text color="faintForeground">faint</Text>
          <Text color="highlight">highlight</Text>
        </View>
        <Text variant="caption" color="mutedForeground">
          {Object.keys(rawPalette).length} raw palette values back these tokens; components use only
          the semantic names.
        </Text>
      </Section>

      <Section title="Spacing">
        {spacing.map(([step, className]) => (
          <View key={step} className="flex-row items-center gap-3">
            <Text variant="caption" color="faintForeground" className="w-10">
              {step}
            </Text>
            <View className={`h-3 rounded-xs bg-primary ${className}`} />
          </View>
        ))}
      </Section>

      <Section title="Radius">
        <View className="flex-row flex-wrap gap-3">
          {radii.map(([name, className]) => (
            <View key={name} className="items-center gap-1">
              <View className={`size-14 border border-border-strong bg-surface ${className}`} />
              <Text variant="caption" color="mutedForeground">
                {name}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Buttons">
        {buttonVariants.map((variant) => (
          <Button key={variant} label={variant} variant={variant} onPress={() => undefined} />
        ))}
        <Button label="lg · 56 · main action" size="lg" onPress={() => undefined} />
        <Button label="md · 50" variant="quiet" onPress={() => undefined} />
        <View className="flex-row flex-wrap gap-2">
          <Button label="sm · 36" size="sm" variant="quiet" onPress={() => undefined} />
          <Button label="Icon" icon={Plus} variant="secondary" onPress={() => undefined} />
          <Button label="Loading" loading onPress={() => undefined} />
          <Button label="Disabled" disabled onPress={() => undefined} />
        </View>
        <Button label="Start round (gym size)" size="gym" icon={Timer} onPress={() => undefined} />
      </Section>

      <Section title="Form controls">
        <Input
          label="Name"
          placeholder="Alex Fighter"
          description="As it appears on your profile."
        />
        <Input label="Weight (kg)" keyboardType="decimal-pad" error="Enter a number." />
        <Input label="Disabled" editable={false} value="Read only" />
        <Textarea label="Notes" placeholder="How did the session go?" />
        <Checkbox
          label="Remember me"
          description="Stay signed in on this device."
          checked={checked}
          onChange={setChecked}
        />
        <Checkbox label="Disabled" checked={false} disabled onChange={() => undefined} />
        <Switch label="Round notifications" value={enabled} onChange={setEnabled} />
        <RadioGroup
          label="Stance"
          options={[
            { value: "orthodox", label: "Orthodox" },
            { value: "southpaw", label: "Southpaw", description: "Left-handed" },
          ]}
          value={stance}
          onChange={setStance}
        />
        <SegmentedControl
          label="Round"
          segments={[
            { value: "r1", label: "Round 1" },
            { value: "r2", label: "Round 2" },
            { value: "r3", label: "Round 3" },
          ]}
          value={round}
          onChange={setRound}
        />
      </Section>

      <Section title="Badges and avatars">
        <View className="flex-row flex-wrap gap-2">
          {badgeVariants.map((variant) => (
            <Badge key={variant} label={variant} variant={variant} />
          ))}
          <Badge label="Live" variant="warning" icon={Bell} />
        </View>
        <View className="flex-row items-center gap-3">
          <Avatar name="Alex Fighter" size="sm" />
          <Avatar name="Maria Coach" />
          <Avatar name="Gym" size="lg" />
        </View>
      </Section>

      <Section title="Card, loading and icons">
        <Card>
          <View className="flex-row items-center gap-2">
            <Icon icon={Dumbbell} color="highlight" />
            <Text variant="title">Session card</Text>
          </View>
          <Text color="mutedForeground">Cards sit on surface with a 22 pt radius.</Text>
          <Separator />
          <View className="gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </View>
          <Spinner label="Loading sessions" />
        </Card>
        <Card compact elevated>
          <Text variant="title">Compact elevated card</Text>
          <Text variant="bodySm" color="mutedForeground">
            Radius 20 pt, padding 14 × 16.
          </Text>
        </Card>
      </Section>

      <Section title="Overlays and feedback">
        <Button label="Open modal" variant="quiet" onPress={() => setModalOpen(true)} />
        <View className="flex-row flex-wrap gap-2">
          <Button
            label="Toast"
            size="sm"
            variant="quiet"
            onPress={() => toast.show({ title: "Saved" })}
          />
          <Button
            label="Success"
            size="sm"
            variant="quiet"
            onPress={() => toast.show({ title: "Round logged", tone: "success" })}
          />
          <Button
            label="Warning"
            size="sm"
            variant="quiet"
            onPress={() => toast.show({ title: "Weigh-in tomorrow", tone: "warning" })}
          />
          <Button
            label="Error"
            size="sm"
            variant="secondary"
            onPress={() =>
              toast.show({
                title: "Could not save",
                description: "Try again.",
                tone: "destructive",
              })
            }
          />
        </View>
        <Modal
          visible={modalOpen}
          onClose={() => setModalOpen(false)}
          title="End session?"
          description="Your rounds so far will be saved."
          closeLabel="Close"
        >
          <Button label="End session" onPress={() => setModalOpen(false)} />
          <Button label="Keep training" variant="ghost" onPress={() => setModalOpen(false)} />
        </Modal>
      </Section>
    </Screen>
  );
}
