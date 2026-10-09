import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  Modal,
  View,
  useWindowDimensions,
  type LayoutRectangle,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "@/shared/styles/theme";

/*
 * Coach marks on real, mounted UI (SF-41). Components register the views a
 * guide can point at (`useSpotlightTarget`); a guide measures one when it is
 * shown (`useSpotlightTargets().measure`) and draws `Spotlight` around it.
 * Nothing is positioned from artboard coordinates: every rectangle comes from
 * the current layout, in window coordinates.
 */

type Measurable = Pick<View, "measureInWindow">;

type Registry = {
  register: (id: string, node: Measurable | null) => void;
  measure: (id: string) => Promise<LayoutRectangle | undefined>;
};

const SpotlightContext = createContext<Registry | null>(null);

/** Holds the spotlight targets of everything rendered inside it. */
export function SpotlightProvider({ children }: { children: ReactNode }) {
  const nodes = useRef(new Map<string, Measurable>());

  const value = useMemo<Registry>(
    () => ({
      register: (id, node) => {
        if (node === null) nodes.current.delete(id);
        else nodes.current.set(id, node);
      },
      measure: (id) =>
        new Promise((resolve) => {
          const node = nodes.current.get(id);
          if (node === undefined) return resolve(undefined);
          node.measureInWindow((x, y, width, height) =>
            resolve(width > 0 && height > 0 ? { x, y, width, height } : undefined),
          );
        }),
    }),
    [],
  );

  return <SpotlightContext value={value}>{children}</SpotlightContext>;
}

/** A ref that makes the view a spotlight target named `id` (a no-op outside a provider). */
export function useSpotlightTarget(id: string) {
  const registry = useContext(SpotlightContext);
  return useCallback(
    (node: Measurable | null) => {
      registry?.register(id, node);
    },
    [registry, id],
  );
}

/** Measures registered targets (`undefined` when not mounted or not laid out). */
export function useSpotlightTargets(): Pick<Registry, "measure"> {
  const registry = useContext(SpotlightContext);
  return useMemo(() => ({ measure: registry?.measure ?? (async () => undefined) }), [registry]);
}

/** Whether the system asks for reduced motion (kept current while mounted). */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

const ARROW = 16;
const GAP = 13;
const MARGIN = 20;

/** Where the card goes for a target: below when there is room, else above, clamped on screen. */
export function placeCard(
  target: LayoutRectangle,
  cardHeight: number,
  screen: { width: number; height: number },
  insets: { top: number; bottom: number },
) {
  const below = screen.height - insets.bottom - (target.y + target.height) - GAP;
  const above = target.y - insets.top - GAP;
  const side: "below" | "above" =
    below >= cardHeight || (below >= above && above < cardHeight) ? "below" : "above";
  const raw = side === "below" ? target.y + target.height + GAP : target.y - GAP - cardHeight;
  const top = Math.min(
    Math.max(raw, insets.top + 8),
    screen.height - insets.bottom - cardHeight - 8,
  );
  const centre = target.x + target.width / 2;
  const arrowLeft = Math.min(
    Math.max(centre - ARROW / 2, MARGIN + 18),
    screen.width - MARGIN - 18 - ARROW,
  );
  const arrowTop = side === "below" ? top - ARROW / 2 : top + cardHeight - ARROW / 2;
  return { side, top, arrowLeft, arrowTop };
}

/** A rounded-rectangle hole in a full-screen path (even-odd fill). */
function holePath(screen: { width: number; height: number }, r: LayoutRectangle, radius: number) {
  const k = Math.min(radius, r.width / 2, r.height / 2);
  const { x, y, width: w, height: h } = r;
  return [
    `M0 0H${screen.width}V${screen.height}H0Z`,
    `M${x + k} ${y}H${x + w - k}A${k} ${k} 0 0 1 ${x + w} ${y + k}`,
    `V${y + h - k}A${k} ${k} 0 0 1 ${x + w - k} ${y + h}`,
    `H${x + k}A${k} ${k} 0 0 1 ${x} ${y + h - k}`,
    `V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z`,
  ].join("");
}

/**
 * The coach-mark overlay: the screen dimmed except `target` (grown by
 * `padding`, rounded by `radius`), a ring around it, and `card` with an
 * arrow pointing at it. Rendered in a modal so it covers the tab bar; no
 * animation when the system asks for reduced motion. `cardHeight` is the
 * card's measured height (0 until known: the card renders hidden).
 */
export function Spotlight({
  visible,
  target,
  padding = 4,
  radius = 28,
  insets,
  card,
  cardHeight,
  onRequestClose,
}: {
  visible: boolean;
  target: LayoutRectangle | undefined;
  padding?: number;
  radius?: number;
  insets: { top: number; bottom: number };
  card: ReactNode;
  cardHeight: number;
  onRequestClose: () => void;
}) {
  const screen = useWindowDimensions();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const ring =
    target === undefined
      ? undefined
      : {
          x: target.x - padding,
          y: target.y - padding,
          width: target.width + padding * 2,
          height: target.height + padding * 2,
        };
  const place = ring === undefined ? undefined : placeCard(ring, cardHeight, screen, insets);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={onRequestClose}
    >
      <View className="flex-1" accessibilityViewIsModal>
        {ring !== undefined ? (
          <Svg
            width={screen.width}
            height={screen.height}
            // eslint-disable-next-line no-restricted-syntax -- absolute fill of a third-party SVG root
            style={{ position: "absolute", left: 0, top: 0 }}
            pointerEvents="none"
          >
            <Path
              d={holePath(screen, ring, radius + padding)}
              fill={colors.overlay}
              fillOpacity={0.74}
              fillRule="evenodd"
            />
          </Svg>
        ) : (
          <View className="absolute inset-0 bg-overlay opacity-75" />
        )}
        {ring !== undefined ? (
          <View
            pointerEvents="none"
            className="absolute border-2 border-highlight"
            // Runtime geometry measured from the mounted target.
            style={{
              left: ring.x,
              top: ring.y,
              width: ring.width,
              height: ring.height,
              borderRadius: radius + padding,
            }}
          />
        ) : null}
        {place !== undefined && cardHeight > 0 ? (
          <View
            pointerEvents="none"
            className="absolute size-4 rotate-45 rounded-xs bg-secondary"
            // Runtime geometry: the arrow points at the target's centre.
            style={{ left: place.arrowLeft, top: place.arrowTop }}
          />
        ) : null}
        <View
          className="absolute inset-x-5"
          // Runtime geometry; hidden until the card's height is known.
          style={
            place === undefined
              ? { top: insets.top + 24 }
              : { top: place.top, opacity: cardHeight > 0 ? 1 : 0 }
          }
        >
          {card}
        </View>
      </View>
    </Modal>
  );
}
