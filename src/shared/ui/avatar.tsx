import { useState } from "react";
import { Image, View } from "react-native";

import { Text } from "./text";

const sizes = {
  sm: { box: "size-8", text: "badge" },
  md: { box: "size-11", text: "title" },
  lg: { box: "size-16", text: "metricSm" },
} as const;

/** Initials from a display name ("Ada Lovelace" → "AL"). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/**
 * Person avatar: image when available, otherwise initials. The accessible
 * name is the person's name, never the initials.
 */
export function Avatar({
  name,
  imageUrl,
  size = "md",
}: {
  name: string;
  imageUrl?: string | undefined;
  size?: keyof typeof sizes;
}) {
  const [failed, setFailed] = useState(false);
  const scale = sizes[size];
  const showImage = imageUrl !== undefined && !failed;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      className={`items-center justify-center overflow-hidden rounded-full bg-highlight ${scale.box}`}
    >
      {showImage ? (
        <Image source={{ uri: imageUrl }} onError={() => setFailed(true)} className="size-full" />
      ) : (
        <Text variant={scale.text} color="highlightForeground">
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}
