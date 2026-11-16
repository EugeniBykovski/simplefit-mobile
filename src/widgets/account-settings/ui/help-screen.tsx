import { useQuery } from "@tanstack/react-query";
import { FileText, ShieldCheck, UsersRound } from "lucide-react-native";
import { View } from "react-native";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { useAccountProfile, type AccountProfile } from "@/entities/account-profile";
import {
  getGetLegalDocumentQueryKey,
  getLegalDocument,
} from "@/shared/api/generated/endpoints/legal/legal";
import { Screen } from "@/shared/ui/screen";

import {
  SettingsLoad,
  SettingsNote,
  SettingsRow,
  SettingsSection,
  useRouteTitle,
} from "./settings-parts";

const DISCLOSURE = "fighter-coach-disclosure" as const;

/*
 * ST13 · Help & legal (SF-161; SetHelp.dc.html) on `mobile.settings.help`.
 * Legal facts come from the backend only: the Terms of Service and Privacy
 * Policy versions this account accepted, and whether a newer one is in force
 * (AccountProfile consents, ADR 0016); and the published fighter-coach data
 * sharing notice (SF-72, `GET /api/v1/legal-documents/…`, the app language,
 * never another). Their full texts are not published to the app, and there is
 * no support channel, help search, guidelines or licence page yet: those are
 * stated, not invented (D-SF161-08).
 */
export function HelpScreen() {
  useRouteTitle("mobile.settings.help");
  const t = useTranslations("accountSettings.help");
  const profile = useAccountProfile();
  if (profile.data === undefined)
    return <SettingsLoad failed={profile.isError} onRetry={() => void profile.refetch()} />;
  return (
    <Screen>
      <View className="gap-5" testID="settings:help">
        <SettingsSection title={t("legalTitle")}>
          <ConsentRow kind="terms" consents={profile.data.consents} />
          <ConsentRow kind="privacy" consents={profile.data.consents} />
          <DisclosureRow />
        </SettingsSection>
        <SettingsNote>{t("textUnavailable")}</SettingsNote>
        <SettingsSection title={t("supportTitle")}>
          <SettingsRow label={t("supportUnavailable")} last />
        </SettingsSection>
      </View>
    </Screen>
  );
}

function ConsentRow({
  kind,
  consents,
}: {
  kind: "terms" | "privacy";
  consents: AccountProfile["consents"];
}) {
  const t = useTranslations("accountSettings.help");
  const format = useFormatter();
  const consent = consents[kind];
  const accepted =
    consent.accepted && consent.accepted_version !== null && consent.accepted_at !== null
      ? t("accepted", {
          version: consent.accepted_version,
          date: format.dateTime(new Date(consent.accepted_at), { dateStyle: "medium" }),
        })
      : t("notAccepted");
  return (
    <SettingsRow
      icon={kind === "terms" ? FileText : ShieldCheck}
      label={t(kind)}
      line={
        consent.current
          ? accepted
          : `${accepted} · ${t("newer", { version: consent.current_version })}`
      }
    />
  );
}

/** The published fighter-coach data sharing notice in the app language, if there is one. */
function DisclosureRow() {
  const t = useTranslations("accountSettings.help");
  const language = useLocale();
  const params = { language };
  const document = useQuery({
    queryKey: getGetLegalDocumentQueryKey(DISCLOSURE, params),
    queryFn: ({ signal }) => getLegalDocument(DISCLOSURE, params, { signal }),
    retry: false,
  });
  const published = document.data?.document.status === "published" ? document.data.document : null;
  return (
    <SettingsRow
      icon={UsersRound}
      label={published?.title ?? t("disclosure")}
      line={
        published !== null
          ? t("disclosureLine", { version: published.version })
          : document.isPending
            ? t("loadingLine")
            : t("disclosureUnavailable")
      }
      last
    />
  );
}
