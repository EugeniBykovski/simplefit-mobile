import { CircleAlert } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";

import { useCoachDataRules, type CoachInvitation } from "@/entities/coach-invitation";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Notice } from "@/shared/ui/notice";
import { Sheet } from "@/shared/ui/sheet";
import { Spinner } from "@/shared/ui/spinner";
import { Text } from "@/shared/ui/text";
import { Textarea } from "@/shared/ui/textarea";

import {
  inviteProblem,
  useAcknowledgeDataRules,
  useCreateInvitation,
  type InviteProblem,
} from "../model/invite";

/*
 * "Invite fighter" (C03 sheet=rules|invite|…, Claude Design
 * 1792155768-3179): the coach data rules first when the backend asks for
 * them, then the email and an optional note. The data rules show exactly the
 * version the backend serves, with an unticked acknowledgement; no legal
 * text is invented (a document link comes with SF-71/72). While no version
 * is configured, or sharing is off, inviting is truthfully blocked.
 * Success says only that an invitation to the address is pending: the
 * backend answers a reused pending invitation like a new one, and no email
 * is claimed as sent.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ONE_PARAGRAPH = /^[^\r\n\t]*$/;

export function InviteFighterSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("coachFighters.invite");
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dismissible={!busy}
      title={t("title")}
      closeLabel={t("close")}
    >
      {visible ? <Composer onClose={onClose} onBusy={setBusy} /> : null}
    </Sheet>
  );
}

function Composer({ onClose, onBusy }: { onClose: () => void; onBusy: (busy: boolean) => void }) {
  const t = useTranslations("coachFighters.invite");
  const rules = useCoachDataRules();
  const [sent, setSent] = useState<CoachInvitation | null>(null);
  const [blocked, setBlocked] = useState(false);

  if (sent) return <Pending invitation={sent} onClose={onClose} />;
  if (rules.isError || blocked || (rules.data && rules.data.document_version === null)) {
    return (
      <View className="gap-3.5" testID="invite:blocked">
        <Notice tone="amber" icon={CircleAlert}>
          {`${t("blocked.title")} ${t("blocked.body")}`}
        </Notice>
        <Button label={t("close")} variant="quiet" onPress={onClose} />
      </View>
    );
  }
  if (rules.data === undefined) {
    return (
      <View className="min-h-32 items-center justify-center">
        <Spinner label={t("checking")} />
      </View>
    );
  }
  if (rules.data.acknowledged_at === null) {
    return (
      <Rules
        version={rules.data.document_version ?? ""}
        onBlocked={() => setBlocked(true)}
        onBusy={onBusy}
        onClose={onClose}
      />
    );
  }
  return (
    <Form
      onSent={setSent}
      onBlocked={() => setBlocked(true)}
      onRules={() => void rules.refetch()}
      onBusy={onBusy}
      onClose={onClose}
    />
  );
}

function Rules({
  version,
  onBlocked,
  onBusy,
  onClose,
}: {
  version: string;
  onBlocked: () => void;
  onBusy: (busy: boolean) => void;
  onClose: () => void;
}) {
  const t = useTranslations("coachFighters.rules");
  const [agreed, setAgreed] = useState(false);
  const [stale, setStale] = useState(false);
  const acknowledge = useAcknowledgeDataRules();
  const pending = acknowledge.isPending;

  return (
    <View className="gap-3.5" testID="invite:rules">
      <Text variant="bodySm" color="mutedForeground">
        {t("body")}
      </Text>
      {stale ? (
        <View accessibilityRole="alert">
          <Notice tone="amber" icon={CircleAlert}>
            {t("stale")}
          </Notice>
        </View>
      ) : null}
      {acknowledge.isError ? (
        <View accessibilityRole="alert">
          <Notice tone="coral" icon={CircleAlert}>
            {t("failed")}
          </Notice>
        </View>
      ) : null}
      <Checkbox
        label={t("agree", { version })}
        checked={agreed}
        disabled={pending}
        onChange={setAgreed}
      />
      <Button
        label={pending ? t("pending") : t("acknowledge")}
        loading={pending}
        disabled={!agreed || pending}
        onPress={() => {
          setStale(false);
          onBusy(true);
          acknowledge.mutate(version, {
            onSuccess: (outcome) => {
              if (outcome === "blocked") onBlocked();
              if (outcome === "stale") {
                // A newer version is current: review it and agree again.
                setAgreed(false);
                setStale(true);
              }
            },
            onSettled: () => onBusy(false),
          });
        }}
      />
      <Button label={t("later")} variant="quiet" disabled={pending} onPress={onClose} />
    </View>
  );
}

function Form({
  onSent,
  onBlocked,
  onRules,
  onBusy,
  onClose,
}: {
  onSent: (invitation: CoachInvitation) => void;
  onBlocked: () => void;
  onRules: () => void;
  onBusy: (busy: boolean) => void;
  onClose: () => void;
}) {
  const t = useTranslations("coachFighters.invite");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [noteError, setNoteError] = useState<string>();
  const [problem, setProblem] = useState<InviteProblem | null>(null);
  const create = useCreateInvitation();
  const pending = create.isPending;

  const submit = () => {
    const nextEmail = EMAIL.test(email.trim()) ? undefined : t("email.invalid");
    const nextNote =
      note.trim().length <= 500 && ONE_PARAGRAPH.test(note.trim()) ? undefined : t("note.invalid");
    setEmailError(nextEmail);
    setNoteError(nextNote);
    setProblem(null);
    if (nextEmail || nextNote || pending) return;
    onBusy(true);
    create.mutate(
      { email, note },
      {
        onSuccess: onSent,
        onError: (error) => {
          const next = inviteProblem(error);
          if (next.kind === "email") setEmailError(next.own ? t("email.own") : t("email.invalid"));
          else if (next.kind === "note") setNoteError(t("note.invalid"));
          else if (next.kind === "blocked") onBlocked();
          else if (next.kind === "rules") onRules();
          else setProblem(next);
        },
        onSettled: () => onBusy(false),
      },
    );
  };

  return (
    <View className="gap-3.5" testID="invite:form">
      <Text variant="bodySm" color="mutedForeground">
        {t("lead")}
      </Text>
      <Input
        label={t("email.label")}
        value={email}
        onChangeText={setEmail}
        error={emailError}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        editable={!pending}
      />
      <Textarea
        label={t("note.label")}
        value={note}
        onChangeText={setNote}
        error={noteError}
        maxLength={500}
        editable={!pending}
      />
      {problem ? (
        <View accessibilityRole="alert">
          <Notice tone={problem.kind === "failed" ? "coral" : "amber"} icon={CircleAlert}>
            {problem.kind === "limited"
              ? t("limited", { minutes: problem.minutes })
              : problem.kind === "pendingLimit"
                ? t("pendingLimit")
                : t("failed")}
          </Notice>
        </View>
      ) : null}
      <Button
        label={pending ? t("sending") : t("submit")}
        loading={pending}
        disabled={pending}
        onPress={submit}
      />
      <Button label={t("cancel")} variant="quiet" disabled={pending} onPress={onClose} />
    </View>
  );
}

function Pending({ invitation, onClose }: { invitation: CoachInvitation; onClose: () => void }) {
  const t = useTranslations("coachFighters.invite");
  const format = useFormatter();
  return (
    <View className="gap-3.5" testID="invite:pending">
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLiveRegion="polite"
        className="gap-1.5"
      >
        <Text variant="title">{t("pending.title")}</Text>
        <Text variant="bodySm" color="mutedForeground">
          {t("pending.body", {
            email: invitation.recipient_email,
            expires: format.dateTime(new Date(invitation.expires_at), "date"),
          })}
        </Text>
      </View>
      <Button label={t("pending.done")} onPress={onClose} />
    </View>
  );
}
