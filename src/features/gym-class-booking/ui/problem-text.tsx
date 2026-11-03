import { CircleAlert, TriangleAlert } from "lucide-react-native";
import { useCallback } from "react";
import { useTranslations } from "use-intl";

import { Notice } from "@/shared/ui/notice";

import { isBookingFailure, type BookingProblem } from "../model/booking-problem";

/** The sentence for a refused or unconfirmed booking, cancellation or check-in. */
export function useBookingProblemText() {
  const t = useTranslations("gymBooking.problems");
  return useCallback(
    (problem: BookingProblem) => {
      switch (problem.kind) {
        case "limited":
          return problem.minutes === null
            ? t("limitedLater")
            : t("limited", { minutes: problem.minutes });
        case "full":
          return problem.capacity === null
            ? t("fullSome")
            : t("full", { capacity: problem.capacity });
        case "bookingCancelled":
          return t("bookingCancelled");
        case "membership":
          return problem.status === "requested" ? t("membershipRequested") : t("membership");
        default:
          return t(problem.kind);
      }
    },
    [t],
  );
}

/** A refusal (amber) or failure (coral), announced politely. */
export function BookingProblemNotice({ problem }: { problem: BookingProblem }) {
  const text = useBookingProblemText();
  const failure = isBookingFailure(problem);
  return (
    <Notice tone={failure ? "coral" : "amber"} icon={failure ? CircleAlert : TriangleAlert} live>
      {text(problem)}
    </Notice>
  );
}
