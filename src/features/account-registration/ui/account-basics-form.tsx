import { Check, CircleAlert } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";

import {
  useAccountProfile,
  useAccountProfileActions,
  type AccountProfile,
} from "@/entities/account-profile";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Input } from "@/shared/ui/input";
import { Notice } from "@/shared/ui/notice";
import { Spinner } from "@/shared/ui/spinner";
import { Text } from "@/shared/ui/text";

import { datePattern, isoFromMasked, maskDate, maskedFromIso } from "@/shared/lib/date-input";

import {
  clientErrors,
  patchFrom,
  rejectionOf,
  valuesFrom,
  type AccountField,
  type AccountValues,
  type Errors,
} from "../model/form";

/*
 * O04 "A few basics" (Claude Design 1a, `Consent`, 390 × 844) on the SF-44
 * account registration, the same contract as the web WA5:
 *
 * - Full name and date of birth (the artboard draws full name on O02, which
 *   the email registration API cannot take and Google / Apple users never
 *   see, so it is asked here for everyone), Terms of Service and Privacy
 *   Policy (required), product news (optional). The artboard's
 *   contact-sport / health notice is not a global requirement (ADR 0016).
 * - Nothing is ticked for the person: a required consent is ticked only when
 *   the current version is already accepted, and then it cannot be
 *   withdrawn here. Only intentional edits are sent.
 * - "Agree and continue" saves, then asks the server to complete
 *   registration; the onboarding gate continues to the resolved entry once
 *   it is complete (here or on another client).
 *
 * The Terms and Privacy documents (SF-48) are not published yet, so their
 * names are not links.
 */

type Failure = "save" | "complete";

export function AccountBasicsForm({
  layout,
}: {
  /** Places the fields and the pinned action in the screen. */
  layout: (parts: { body: ReactNode; actions: ReactNode }) => ReactNode;
}) {
  const t = useTranslations("auth.basics");
  const query = useAccountProfile();

  if (query.data === undefined) {
    return layout({
      body: query.isError ? (
        <Notice tone="coral" icon={CircleAlert}>
          {t("loadFailed")}
        </Notice>
      ) : (
        <View className="items-center py-10">
          <Spinner label={t("loading")} />
        </View>
      ),
      actions: query.isError ? (
        <Button label={t("retry")} size="lg" onPress={() => void query.refetch()} />
      ) : null,
    });
  }
  return <Form profile={query.data} layout={layout} />;
}

function Form({
  profile,
  layout,
}: {
  profile: AccountProfile;
  layout: (parts: { body: ReactNode; actions: ReactNode }) => ReactNode;
}) {
  const t = useTranslations("auth.basics");
  const locale = useLocale();
  const { save, complete } = useAccountProfileActions();
  const [values, setValues] = useState<AccountValues>(() => valuesFrom(profile));
  const [dateText, setDateText] = useState(() =>
    maskedFromIso(profile.date_of_birth ?? "", locale),
  );
  const [dirty, setDirty] = useState<Partial<Record<AccountField, boolean>>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure>();

  const termsLocked = profile.consents.terms.current;
  const privacyLocked = profile.consents.privacy.current;

  const change = <K extends AccountField>(field: K, value: AccountValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setDirty((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function submit() {
    if (busy) return;
    const found = clientErrors(values, dateText);
    const patch = patchFrom(values, dirty, found);
    setBusy(true);
    setFailure(undefined);
    try {
      if (Object.keys(patch).length > 0) {
        try {
          await save(patch);
          setDirty({});
        } catch (error) {
          const rejected = rejectionOf(error);
          if (rejected === undefined) {
            setFailure("save");
            return;
          }
          setErrors({ ...found, ...rejected });
          return;
        }
      }
      if (Object.keys(found).length > 0) {
        setErrors(found);
        return;
      }
      try {
        await complete();
      } catch (error) {
        const rejected = rejectionOf(error);
        if (rejected === undefined) setFailure("complete");
        else setErrors(rejected);
      }
    } finally {
      setBusy(false);
    }
  }

  const message = (field: AccountField) => {
    const code = errors[field];
    return code === undefined ? undefined : t(`errors.${code}`);
  };

  const body = (
    <>
      <View className="gap-2">
        <Text variant="h1" accessibilityRole="header">
          {t("title")}
        </Text>
        <Text color="mutedForeground">{t("description")}</Text>
      </View>
      <Input
        label={t("fullName")}
        value={values.full_name}
        onChangeText={(text) => change("full_name", text)}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        maxLength={200}
        error={message("full_name")}
        editable={!busy}
      />
      <Input
        label={t("dateOfBirth")}
        value={dateText}
        onChangeText={(text) => {
          const masked = maskDate(text, locale);
          setDateText(masked);
          change("date_of_birth", isoFromMasked(masked, locale));
        }}
        placeholder={datePattern(locale, {
          day: t("letters.day"),
          month: t("letters.month"),
          year: t("letters.year"),
        })}
        keyboardType="number-pad"
        autoComplete="birthdate-full"
        description={profile.registration.completed_at === null ? t("dateHint") : t("dateLocked")}
        error={message("date_of_birth")}
        editable={!busy && profile.registration.completed_at === null}
      />
      <View className="rounded-3xl border border-border bg-surface px-4 py-1">
        <ConsentRow
          label={t("terms")}
          note={t("required")}
          checked={values.accept_terms}
          locked={termsLocked}
          disabled={busy}
          error={message("accept_terms")}
          onChange={(checked) => change("accept_terms", checked)}
        />
        <ConsentRow
          label={t("privacy")}
          note={t("privacyNote")}
          checked={values.accept_privacy}
          locked={privacyLocked}
          disabled={busy}
          error={message("accept_privacy")}
          onChange={(checked) => change("accept_privacy", checked)}
        />
        <ConsentRow
          label={t("news")}
          note={t("newsNote")}
          checked={values.product_news}
          disabled={busy}
          last
          onChange={(checked) => change("product_news", checked)}
        />
      </View>
      <Text variant="caption" color="faintForeground">
        {t("legalPending")}
      </Text>
      {failure !== undefined && (
        <Notice tone="coral" icon={CircleAlert}>
          {t(failure === "save" ? "saveFailed" : "completeFailed")}
        </Notice>
      )}
    </>
  );

  return layout({
    body,
    actions: <Button label={t("submit")} size="lg" loading={busy} onPress={() => void submit()} />,
  });
}

/**
 * One consent row (O04): the label and its note, the 24 pt checkbox on the
 * right. A required consent already accepted in its current version is shown
 * ticked and cannot be withdrawn here.
 */
function ConsentRow({
  label,
  note,
  checked,
  locked = false,
  disabled,
  error,
  last = false,
  onChange,
}: {
  label: string;
  note: string;
  checked: boolean;
  locked?: boolean;
  disabled: boolean;
  error?: string | undefined;
  last?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const inactive = disabled || locked;
  return (
    <View className={last ? "" : "border-b border-border"}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityHint={note}
        accessibilityState={{ checked, disabled: inactive }}
        disabled={inactive}
        onPress={() => onChange(!checked)}
        className="min-h-15 flex-row items-center gap-3 py-2"
      >
        <View className="flex-1 gap-0.5">
          <Text variant="body" weight="extrabold">
            {label}
          </Text>
          <Text variant="caption" color="mutedForeground">
            {note}
          </Text>
        </View>
        <View
          className={`size-6 items-center justify-center rounded-sm ${checked ? "bg-highlight" : "border-2 border-border-strong"}`}
        >
          {checked ? <Icon icon={Check} size={15} color="highlightForeground" /> : null}
        </View>
      </Pressable>
      {error !== undefined && (
        <Text
          variant="caption"
          color="destructive"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="pb-2"
        >
          {error}
        </Text>
      )}
    </View>
  );
}
