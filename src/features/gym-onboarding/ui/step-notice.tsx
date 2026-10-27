import { CircleAlert, TriangleAlert } from "lucide-react-native";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { Button } from "@/shared/ui/button";
import { Notice } from "@/shared/ui/notice";

import type { Requirement } from "../model/errors";
import type { FormStep } from "../model/steps";
import { sentences } from "./steps";

/** What a step tried when it failed. */
export type StepAction = "create" | "save" | "finish";

export type StepProblem =
  | { kind: "unconfirmed"; action: StepAction }
  | { kind: "invalid" }
  | { kind: "rejected"; missing: Requirement[]; step: FormStep }
  | { kind: "stale" }
  | { kind: "resumed" }
  | { kind: "discarded" }
  | { kind: "reused" }
  | { kind: "rateLimited"; minutes: number | null }
  | { kind: "forbidden" }
  | { kind: "gone" }
  | { kind: "session" }
  | { kind: "conflict" };

const REQUIREMENTS: readonly Requirement[] = ["name", "gym_type", "primary_location"];

/**
 * A step's status notice (the same states as the web, SF-86). Amber: act on
 * it, nothing was lost; coral: something to change. Each is announced (live
 * region), and its one action sits under it:
 *
 * - `unconfirmed`: no answer arrived; nothing typed is lost; Retry is safe
 *   (creation repeats its key, every save carries its revision);
 * - `stale`: another session changed the gym; the latest values are loaded,
 *   the visitor's edits kept; only "Save my changes" writes them;
 * - `rejected`: completion found requirements missing, with a way to them.
 */
export function StepNotice({
  problem,
  onRetry,
  onGoTo,
  onRestart,
}: {
  problem: StepProblem;
  onRetry: () => void;
  onGoTo: (step: FormStep) => void;
  onRestart: () => void;
}) {
  const t = useTranslations("gymOnboarding.notices");
  const text = sentences;
  let tone: "amber" | "coral" = "amber";
  let body: string;
  let action: { label: string; onPress: () => void } | undefined;

  switch (problem.kind) {
    case "unconfirmed":
      body = text(t(`unconfirmed.${problem.action}`), t(`unconfirmed.${problem.action}Body`));
      action = { label: t("unconfirmed.retry"), onPress: onRetry };
      break;
    case "invalid":
      tone = "coral";
      body = text(t("invalid.title"), t("invalid.body"));
      break;
    case "rejected": {
      tone = "coral";
      const fields = REQUIREMENTS.filter((field) => problem.missing.includes(field))
        .map((field) => t(`rejected.fields.${field}`))
        .join(", ");
      const first = problem.missing[0] ?? "primary_location";
      body = text(t("rejected.title"), t("rejected.body", { fields }));
      action = { label: t(`rejected.goTo.${first}`), onPress: () => onGoTo(problem.step) };
      break;
    }
    case "stale":
      body = text(t("stale.title"), t("stale.body"));
      action = { label: t("stale.reapply"), onPress: onRetry };
      break;
    case "resumed":
      body = text(t("resumed.title"), t("resumed.body"));
      break;
    case "discarded":
    case "reused":
      body = text(t(`${problem.kind}.title`), t(`${problem.kind}.body`));
      break;
    case "rateLimited":
      body = text(
        t("rateLimited.title"),
        problem.minutes === null
          ? t("rateLimited.body")
          : t("rateLimited.bodyAfter", { minutes: problem.minutes }),
      );
      break;
    case "forbidden":
      tone = "coral";
      body = text(t("forbidden.title"), t("forbidden.body"));
      break;
    case "gone":
      body = text(t("gone.title"), t("gone.body"));
      action = { label: t("gone.restart"), onPress: onRestart };
      break;
    case "session":
      body = text(t("session.title"), t("session.body"));
      break;
    case "conflict":
      body = text(t("conflict.title"), t("conflict.body"));
      action = { label: t("unconfirmed.retry"), onPress: onRetry };
      break;
  }

  const icon = tone === "coral" ? CircleAlert : TriangleAlert;
  return (
    <View className="gap-2" testID={`step-notice-${problem.kind}`}>
      <Notice tone={tone} icon={icon} live>
        {body}
      </Notice>
      {action ? <Button label={action.label} variant="quiet" onPress={action.onPress} /> : null}
    </View>
  );
}
