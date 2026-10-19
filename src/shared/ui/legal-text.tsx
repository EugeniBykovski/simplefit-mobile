import { View } from "react-native";

import { parseLegalText } from "@/shared/lib/legal-text";

import { Text } from "./text";

/**
 * An approved legal text from the backend (SF-72), rendered from its
 * Markdown subset as native text: headings, paragraphs and bullet lists.
 * Never interpreted as markup or links.
 */
export function LegalText({ text, testID }: { text: string; testID?: string }) {
  return (
    <View className="gap-2.5" testID={testID}>
      {parseLegalText(text).map((block, index) => {
        if (block.kind === "heading") {
          return (
            <Text
              key={index}
              accessibilityRole="header"
              variant={block.level === 1 ? "title" : "body"}
              weight={block.level === 1 ? undefined : "bold"}
            >
              {block.text}
            </Text>
          );
        }
        if (block.kind === "list") {
          return (
            <View key={index} className="gap-1" accessibilityRole="list">
              {block.items.map((item, itemIndex) => (
                <View key={itemIndex} className="flex-row gap-2">
                  <Text variant="bodySm" color="mutedForeground" accessibilityElementsHidden>
                    •
                  </Text>
                  <Text variant="bodySm" className="flex-1">
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={index} variant="bodySm">
            {block.text}
          </Text>
        );
      })}
    </View>
  );
}
