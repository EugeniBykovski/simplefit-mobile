import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * Hermes (the React Native engine on iOS) has no Intl.PluralRules, so an ICU
 * `plural` or `selectordinal` argument throws when the message is formatted
 * (SF-61 invitation cooldown and rate limit; SF-70). Every catalog keeps
 * counts as a number with a fixed unit ("{minutes} min") instead.
 */

const dir = join(__dirname, "messages");
const pluralArgument = /\{\s*\w+\s*,\s*(plural|selectordinal)\s*,/;

function leaves(tree: unknown, path: string[] = []): [string, string][] {
  if (typeof tree === "string") return [[path.join("."), tree]];
  if (typeof tree !== "object" || tree === null) return [];
  return Object.entries(tree).flatMap(([key, value]) => leaves(value, [...path, key]));
}

describe("message catalogs on Hermes", () => {
  it.each(readdirSync(dir).filter((file) => file.endsWith(".json")))(
    "%s uses no ICU plural or selectordinal argument",
    (file) => {
      const messages: unknown = JSON.parse(readFileSync(join(dir, file), "utf8"));
      const offending = leaves(messages).filter(([, text]) => pluralArgument.test(text));
      expect(offending).toEqual([]);
    },
  );
});
