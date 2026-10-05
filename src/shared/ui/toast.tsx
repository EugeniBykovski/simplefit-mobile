import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react-native";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type LucideIcon } from "./icon";
import { Text, type TextColor } from "./text";

export type ToastTone = "neutral" | "success" | "warning" | "destructive";

type ToastMessage = {
  id: number;
  title: string;
  description?: string | undefined;
  tone: ToastTone;
};

type ToastApi = {
  show: (toast: { title: string; description?: string; tone?: ToastTone }) => void;
  dismiss: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const tones: Record<ToastTone, { container: string; icon: LucideIcon; text: TextColor }> = {
  neutral: { container: "border-border bg-surface-elevated", icon: Info, text: "foreground" },
  success: {
    container: "border-success bg-success-subtle",
    icon: CircleCheck,
    text: "successSubtleForeground",
  },
  warning: {
    container: "border-warning bg-warning-subtle",
    icon: TriangleAlert,
    text: "warningSubtleForeground",
  },
  destructive: {
    container: "border-destructive bg-destructive-subtle",
    icon: CircleAlert,
    text: "destructiveSubtleForeground",
  },
};

const DURATION_MS = 4000;

/**
 * Transient, non-blocking feedback. One toast at a time, auto-dismissed after
 * 4 s or on tap; announced to screen readers. Never the only place critical
 * information or errors that need action appear.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const nextId = useRef(0);
  const insets = useSafeAreaInsets();

  const dismiss = useCallback(() => setToast(null), []);
  const show = useCallback<ToastApi["show"]>(({ title, description, tone = "neutral" }) => {
    nextId.current += 1;
    setToast({ id: nextId.current, title, description, tone });
    AccessibilityInfo.announceForAccessibility(description ? `${title}. ${description}` : title);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismiss, DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const tone = toast ? tones[toast.tone] : null;

  return (
    <ToastContext value={api}>
      {children}
      {toast && tone ? (
        // Runtime safe-area inset is the only style value.
        <View
          pointerEvents="box-none"
          className="absolute inset-x-4"
          style={{ bottom: insets.bottom + 16 }}
        >
          <Pressable
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            accessibilityLabel={
              toast.description ? `${toast.title}. ${toast.description}` : toast.title
            }
            onPress={dismiss}
            className={`flex-row items-start gap-3 rounded-2xl border p-4 ${tone.container}`}
          >
            <Icon icon={tone.icon} color={tone.text} />
            <View className="flex-1 gap-0.5">
              <Text weight="bold" color={tone.text}>
                {toast.title}
              </Text>
              {toast.description ? (
                <Text variant="bodySm" color={tone.text}>
                  {toast.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </View>
      ) : null}
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}
