import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type TransitionEvent,
} from "react";
import type { ProjectTermThemeCloudResponse, TermNode } from "../../api";
import HelpTooltip from "../shared/HelpTooltip";
import { cn } from "../../utils/cn";
import { HELP_DASHBOARD_TERM_THEMES } from "../../utils/helpContent";

type Props = {
  payload: ProjectTermThemeCloudResponse;
  onSearch?: (terms: string[]) => void;
};

const HUES = [210, 160, 280, 25, 130, 340, 55, 190];
const MAX_SELECTION = 20;

const VIEWBOX_PAD_X = 12;
const VIEWBOX_PAD_Y = 16;
const SUB_TRUNK_LENGTH = 50;
const SUB_BRANCH_LENGTH = 120;
const SUB_GAP_Y = 60;
const LIST_ITEM_HEIGHT = 52;
const LIST_ITEM_GAP = 20;
const LIST_ITEM_STEP = LIST_ITEM_HEIGHT + LIST_ITEM_GAP;
const LIST_HUB_GAP_PX = 54;
const EXPAND_MIN_W = 320;
const LIST_WIDTH_CLASS = "w-[13.5rem]";
const EXPAND_COL_MIN = "18rem";
const FLYOUT_MS = 480;
const FLYOUT_SWITCH_RETURN_MS = 260;
const FLYOUT_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

function flyoutTransition(ms: number): string {
  return `transform ${ms}ms ${FLYOUT_EASE}, background-color ${ms}ms ${FLYOUT_EASE}, border-color ${ms}ms ${FLYOUT_EASE}, color ${ms}ms ${FLYOUT_EASE}, box-shadow ${ms}ms ${FLYOUT_EASE}`;
}
const PANEL_MS = 400;
const SUB_OPEN_MS = 300;
const SUB_STAGGER_MS = 28;
const SUB_REVEAL_BASE_MS = 48;
const SUB_OPEN_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";
const SUB_NODE_SCALE_HIDDEN = 0.96;
function pillCornerRadius(box: NodeBox): number {
  return Math.min(box.halfW, box.halfH);
}
const CHAR_WIDTH_RATIO = 0.55;
const CAT_LABEL_MAX_CHARS = 24;
const CAT_MIN_HALF_W = 58;
const CAT_MIN_HALF_H = 24;
const CAT_WIDTH_TO_HEIGHT = 1.55;
const CAT_FONT_PX = 14;
const SUB_FONT_PX = 14;
const SUB_NODE_HALF_W = 82;
const SUB_NODE_HALF_H = 22;
const SUB_LABEL_MAX_CHARS = 18;
const CAT_FONT_CLASS = "text-[14px]";
const CAT_BUTTON_LAYOUT =
  "flex items-center justify-center text-center px-3 py-2.5 leading-snug";

const leafPillBase =
  "inline-flex items-center justify-center min-h-[2rem] px-2 py-1 rounded-full bg-tag-bg text-tag-text border border-border text-[0.75rem] leading-tight text-center cursor-pointer transition-[background,border-color,color] duration-150 hover:border-border-strong";

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** SVG fontSize is in viewBox units; convert desired CSS px to match on-screen size. */
function svgFontSizeInUserUnits(cssPx: number, viewBoxWidth: number, displayWidthPx: number): number {
  if (displayWidthPx <= 0 || viewBoxWidth <= 0) return cssPx;
  return cssPx * (viewBoxWidth / displayWidthPx);
}

function splitLabel(label: string, maxCharsPerLine = 14): string[] {
  if (label.includes(" & ")) {
    return label.split(" & ");
  }
  if (label.length <= maxCharsPerLine) {
    return [label];
  }
  const words = label.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word.length > maxCharsPerLine ? word.slice(0, maxCharsPerLine) : word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [label];
}

type NodeBox = {
  halfW: number;
  halfH: number;
};

function boxForInsideText(
  lines: string[],
  fontSize: number,
  minHalfW: number,
  maxHalfW: number,
  minHalfH: number,
  maxHalfH: number,
  padX = 10,
  padY = 8,
): NodeBox {
  const lineHeight = fontSize * 1.25;
  const maxChars = Math.max(...lines.map((l) => l.length), 1);
  const halfW = clamp(maxChars * fontSize * CHAR_WIDTH_RATIO * 0.5 + padX, minHalfW, maxHalfW);
  const halfH = clamp((lines.length * lineHeight) / 2 + padY, minHalfH, maxHalfH);
  return { halfW, halfH };
}

function uniformCatNodeBox(categories: TermNode[], fontSize: number): NodeBox {
  let halfW = CAT_MIN_HALF_W;
  let halfH = CAT_MIN_HALF_H;
  for (const cat of categories) {
    const lines = splitLabel(cat.label, CAT_LABEL_MAX_CHARS);
    const needed = boxForInsideText(lines, fontSize, 0, Infinity, 0, Infinity, 16, 12);
    halfW = Math.max(halfW, needed.halfW);
    halfH = Math.max(halfH, needed.halfH);
  }
  if (halfW < halfH * CAT_WIDTH_TO_HEIGHT) {
    halfW = halfH * CAT_WIDTH_TO_HEIGHT;
  }
  return { halfW, halfH };
}

function rectEdgePoint(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  towardX: number,
  towardY: number,
): [number, number] {
  const dx = towardX - cx;
  const dy = towardY - cy;
  if (dx === 0 && dy === 0) {
    return [cx, cy];
  }
  const scale = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH, 1e-6);
  return [cx + dx * scale, cy + dy * scale];
}

function hubExitX(hubGapPx: number, hubWidthPx: number): number {
  return hubGapPx + hubWidthPx;
}

function spineXFromHub(hubGapPx: number, hubWidthPx: number): number {
  return hubExitX(hubGapPx, hubWidthPx) + SUB_TRUNK_LENGTH;
}

function subcatBusConnectorPath(
  hubGapPx: number,
  hubWidthPx: number,
  hubY: number,
  subPositions: [number, number][],
  subBoxes: NodeBox[],
): string {
  if (subPositions.length === 0) return "";
  const exitX = hubExitX(hubGapPx, hubWidthPx);
  const spineX = spineXFromHub(hubGapPx, hubWidthPx);

  if (subPositions.length === 1) {
    const [sx, sy] = subPositions[0];
    const box = subBoxes[0];
    const [childX] = rectEdgePoint(sx, sy, box.halfW, box.halfH, spineX, sy);
    return `M ${exitX} ${hubY} L ${spineX} ${hubY} L ${childX} ${sy}`;
  }

  const childYs = subPositions.map(([, sy]) => sy);
  const spineTop = Math.min(...childYs);
  const spineBottom = Math.max(...childYs);
  let path = `M ${exitX} ${hubY} L ${spineX} ${hubY} M ${spineX} ${spineTop} L ${spineX} ${spineBottom}`;

  subPositions.forEach(([sx, sy], i) => {
    const box = subBoxes[i];
    const [childX] = rectEdgePoint(sx, sy, box.halfW, box.halfH, spineX, sy);
    path += ` M ${spineX} ${sy} L ${childX} ${sy}`;
  });

  return path;
}

function listSlotTop(index: number): number {
  return index * LIST_ITEM_STEP;
}

function listCenterY(count: number): number {
  if (count <= 0) return LIST_ITEM_HEIGHT / 2;
  const totalH = count * LIST_ITEM_HEIGHT + (count - 1) * LIST_ITEM_GAP;
  return totalH / 2;
}

function hubYForListCenter(count: number): number {
  return listCenterY(count);
}

function subcatListPositions(
  hubGapPx: number,
  hubWidthPx: number,
  hubY: number,
  count: number,
): [number, number][] {
  if (count === 0) return [];
  const subX = spineXFromHub(hubGapPx, hubWidthPx) + SUB_BRANCH_LENGTH;
  const totalSpan = (count - 1) * SUB_GAP_Y;
  const startY = hubY - totalSpan / 2;
  return Array.from({ length: count }, (_, i) => [subX, startY + i * SUB_GAP_Y]);
}

function expandLayoutMetrics(
  hubHalfH: number,
  hubWidthPx: number,
  subCount: number,
  maxSubHalfW: number,
  listCount: number,
): { hubY: number; svgW: number; svgH: number; viewBoxWidth: number; viewBox: string } {
  const hubY = hubYForListCenter(listCount);
  const listHeight = listCount * LIST_ITEM_HEIGHT + Math.max(0, listCount - 1) * LIST_ITEM_GAP;
  const subSpan = subCount > 0 ? (subCount - 1) * SUB_GAP_Y : 0;
  const childColumnX = spineXFromHub(LIST_HUB_GAP_PX, hubWidthPx) + SUB_BRANCH_LENGTH;
  const contentRight = childColumnX + maxSubHalfW + VIEWBOX_PAD_X;
  const contentBottom = Math.max(
    listHeight + VIEWBOX_PAD_Y,
    hubY + hubHalfH + VIEWBOX_PAD_Y,
    hubY + subSpan / 2 + hubHalfH + VIEWBOX_PAD_Y,
  );
  const svgW = Math.max(EXPAND_MIN_W, contentRight);
  const svgH = Math.max(listHeight, contentBottom);
  const viewBoxWidth = svgW + VIEWBOX_PAD_X * 2;
  const viewBox = `${-VIEWBOX_PAD_X} ${-VIEWBOX_PAD_Y} ${viewBoxWidth} ${svgH + VIEWBOX_PAD_Y * 2}`;
  return { hubY, svgW, svgH, viewBoxWidth, viewBox };
}

function subOpenDelay(index: number): string {
  return `${SUB_REVEAL_BASE_MS + index * SUB_STAGGER_MS}ms`;
}

type CatNodeLayout = {
  cat: TermNode;
  hue: number;
  box: NodeBox;
  lines: string[];
};

function subNodeBox(selected: boolean): NodeBox {
  return selected
    ? { halfW: SUB_NODE_HALF_W + 2, halfH: SUB_NODE_HALF_H + 2 }
    : { halfW: SUB_NODE_HALF_W, halfH: SUB_NODE_HALF_H };
}

function expandBox(box: NodeBox, extra: number): NodeBox {
  return { halfW: box.halfW + extra, halfH: box.halfH + extra };
}

function chunkRows<T>(items: T[], perRow: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += perRow) {
    rows.push(items.slice(i, i + perRow));
  }
  return rows;
}

type InsideLabelProps = {
  x: number;
  y: number;
  lines: string[];
  fontSize: number;
  fill: string;
  fontWeight?: number;
  visible?: boolean;
};

type ThemeRectProps = {
  cx: number;
  cy: number;
  box: NodeBox;
  cornerRx: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  onClick?: () => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  ariaLabel: string;
  tabIndex?: number;
};

function ThemeRect({
  cx,
  cy,
  box,
  cornerRx,
  fill,
  stroke,
  strokeWidth,
  onClick,
  onKeyDown,
  ariaLabel,
  tabIndex = 0,
}: ThemeRectProps): ReactElement {
  const { halfW, halfH } = box;
  return (
    <rect
      x={cx - halfW}
      y={cy - halfH}
      width={halfW * 2}
      height={halfH * 2}
      rx={cornerRx}
      ry={cornerRx}
      style={{
        fill,
        stroke,
        strokeWidth,
        cursor: onClick ? "pointer" : "default",
        transition: `x ${SUB_OPEN_MS * 0.4}ms ${SUB_OPEN_EASE}, y ${SUB_OPEN_MS * 0.4}ms ${SUB_OPEN_EASE}, width ${SUB_OPEN_MS * 0.4}ms ${SUB_OPEN_EASE}, height ${SUB_OPEN_MS * 0.4}ms ${SUB_OPEN_EASE}, fill ${SUB_OPEN_MS * 0.4}ms ${SUB_OPEN_EASE}, stroke ${SUB_OPEN_MS * 0.4}ms ${SUB_OPEN_EASE}`,
      }}
      onClick={onClick}
      aria-label={ariaLabel}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? tabIndex : undefined}
      onKeyDown={onKeyDown}
    />
  );
}

function InsideLabel({
  x,
  y,
  lines,
  fontSize,
  fill,
  fontWeight = 500,
  visible = true,
}: InsideLabelProps): ReactElement {
  const lineHeight = fontSize * 1.2;
  const startDy = -((lines.length - 1) * lineHeight) / 2;

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={fontSize}
      fontFamily="DM Sans, sans-serif"
      fill={fill}
      fontWeight={fontWeight}
      style={{
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.25s",
      }}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? startDy : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

type CategoryListButtonProps = {
  label: string;
  hue: number;
  onClick: () => void;
  hidden?: boolean;
  isHub?: boolean;
};

function CategoryListButton({
  label,
  hue,
  onClick,
  hidden = false,
  isHub = false,
}: CategoryListButtonProps): ReactElement {
  return (
    <button
      type="button"
      className={cn(
        "box-border w-full min-h-[3.25rem] rounded-full border-[1.5px] font-semibold cursor-pointer transition-[background,border-color,box-shadow,opacity] duration-150 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        CAT_BUTTON_LAYOUT,
        CAT_FONT_CLASS,
        hidden && "invisible pointer-events-none",
        isHub && "shadow-sm",
      )}
      style={{
        backgroundColor: `hsl(${hue} 42% ${isHub ? 82 : 90}%)`,
        borderColor: `hsl(${hue} ${isHub ? 55 : 30}% ${isHub ? 45 : 72}%)`,
        color: `hsl(${hue} 48% ${isHub ? 22 : 28}%)`,
      }}
      onClick={onClick}
      aria-label={isHub ? `Close ${label}` : `Open ${label} theme`}
    >
      {label}
    </button>
  );
}

type CategoryFlyoutProps = {
  label: string;
  hue: number;
  listIndex: number;
  listCount: number;
  atHub: boolean;
  listWidthPx: number;
  snapPosition: boolean;
  moveMs: number;
  onClose: () => void;
  onTransitionEnd: () => void;
};

const CategoryFlyout = forwardRef<HTMLButtonElement, CategoryFlyoutProps>(function CategoryFlyout(
  { label, hue, listIndex, listCount, atHub, listWidthPx, snapPosition, moveMs, onClose, onTransitionEnd },
  ref,
): ReactElement {
  const hubLeft = listWidthPx + LIST_HUB_GAP_PX;
  const centerY = listCenterY(listCount);
  const translateX = atHub ? hubLeft : 0;
  const translateY = atHub ? centerY - LIST_ITEM_HEIGHT / 2 : listSlotTop(listIndex);

  const handleTransitionEnd = (event: TransitionEvent<HTMLButtonElement>): void => {
    if (event.propertyName === "transform") {
      onTransitionEnd();
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "box-border absolute top-0 left-0 z-20 min-h-[3.25rem] rounded-full border-[1px] font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        CAT_BUTTON_LAYOUT,
        CAT_FONT_CLASS,
        atHub && "shadow-sm",
      )}
      style={{
        width: listWidthPx,
        backgroundColor: `hsl(${hue} 42% ${atHub ? 82 : 90}%)`,
        borderColor: `hsl(${hue} ${atHub ? 55 : 30}% ${atHub ? 45 : 72}%)`,
        color: `hsl(${hue} 48% ${atHub ? 22 : 28}%)`,
        transform: `translate3d(${translateX}px, ${translateY}px, 0)`,
        transition: snapPosition ? "none" : flyoutTransition(moveMs),
      }}
      onClick={onClose}
      onTransitionEnd={handleTransitionEnd}
      aria-label={`Close ${label}`}
    >
      {label}
    </button>
  );
});

export default function ProjectTermsThemeCloud({ payload, onSearch }: Props): ReactElement {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [flyoutId, setFlyoutId] = useState<string | null>(null);
  const [flyoutAtHub, setFlyoutAtHub] = useState(false);
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);
  const [snapFlyoutPosition, setSnapFlyoutPosition] = useState(false);
  const [flyoutMoveMs, setFlyoutMoveMs] = useState(FLYOUT_MS);
  const [subsMounted, setSubsMounted] = useState(false);
  const [subsAnimatedIn, setSubsAnimatedIn] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());
  const [showMaxWarning, setShowMaxWarning] = useState(false);
  const listRef = useRef<HTMLElement>(null);
  const flyoutRef = useRef<HTMLButtonElement>(null);
  const needsFlyToHubRef = useRef(false);
  const [listWidthPx, setListWidthPx] = useState(216);

  const rawTree: TermNode[] = (payload.tree ?? []).filter((n) => n.label !== "Low confidence");
  const buckets = (payload.buckets ?? []).filter((b) => b.label !== "Low confidence");

  const catFontSize = CAT_FONT_PX;
  const catBox = uniformCatNodeBox(rawTree, catFontSize);

  const catNodes: CatNodeLayout[] = rawTree.map((cat, i) => {
    const hue = HUES[i % HUES.length];
    const lines = splitLabel(cat.label, CAT_LABEL_MAX_CHARS);
    return { cat, hue, box: catBox, lines };
  });

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const updateWidth = (): void => setListWidthPx(el.offsetWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [catNodes.length]);

  const resetSubsAnimation = useCallback((): void => {
    setSubsMounted(false);
    setSubsAnimatedIn(false);
  }, []);

  const revealSubsAnimation = useCallback((): void => {
    setSubsMounted(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setSubsAnimatedIn(true));
    });
  }, []);

  const scheduleFlyToHub = useCallback((targetId: string): void => {
    requestAnimationFrame(() => {
      const el = flyoutRef.current;
      if (el) {
        void el.offsetWidth;
      }
      requestAnimationFrame(() => {
        setSnapFlyoutPosition(false);
        setFlyoutMoveMs(FLYOUT_MS);
        setFlyoutAtHub(true);
        setActiveId(targetId);
      });
    });
  }, []);

  useLayoutEffect(() => {
    if (!needsFlyToHubRef.current || flyoutId === null || listWidthPx <= 0) {
      return;
    }
    needsFlyToHubRef.current = false;
    setSnapFlyoutPosition(true);
    scheduleFlyToHub(flyoutId);
  }, [flyoutId, listWidthPx, scheduleFlyToHub]);

  const activeCatNode = catNodes.find((node) => node.cat.id === activeId) ?? null;
  const flyoutNode = catNodes.find((node) => node.cat.id === flyoutId) ?? null;
  const flyoutIndex = flyoutId !== null ? catNodes.findIndex((node) => node.cat.id === flyoutId) : -1;
  const listHeightPx =
    catNodes.length * LIST_ITEM_HEIGHT + Math.max(0, catNodes.length - 1) * LIST_ITEM_GAP;
  const selectedSub =
    activeCatNode?.cat.children?.find((sub) => sub.id === selectedSubId) ?? null;
  const leafTerms: TermNode[] = selectedSub?.children ?? [];
  const leafRows = chunkRows(leafTerms, 3);
  const selectedCount = selectedTerms.size;
  const panelOpen = selectedSub !== null;
  const expansionOpen = flyoutId !== null;
  const expandGridColumn = flyoutAtHub;
  const showSubs = subsMounted && activeId !== null;

  const handleFlyoutTransitionEnd = useCallback((): void => {
    if (pendingSelectId !== null && !flyoutAtHub) {
      const nextId = pendingSelectId;
      setPendingSelectId(null);
      resetSubsAnimation();
      setFlyoutId(nextId);
      setSnapFlyoutPosition(true);
      setFlyoutAtHub(false);
      needsFlyToHubRef.current = true;
      return;
    }
    if (flyoutAtHub && activeId !== null && pendingSelectId === null) {
      revealSubsAnimation();
      return;
    }
    if (!flyoutAtHub && flyoutId !== null && activeId === null && pendingSelectId === null) {
      resetSubsAnimation();
      setFlyoutId(null);
    }
  }, [activeId, flyoutAtHub, flyoutId, pendingSelectId, resetSubsAnimation, revealSubsAnimation]);

  const handleCategoryClick = (catId: string): void => {
    setSelectedSubId(null);
    setSelectedTerms(new Set());
    setShowMaxWarning(false);

    if (activeId === catId && flyoutAtHub) {
      setPendingSelectId(null);
      resetSubsAnimation();
      setSnapFlyoutPosition(false);
      setFlyoutAtHub(false);
      setActiveId(null);
      return;
    }

    if (flyoutId === null) {
      setPendingSelectId(null);
      resetSubsAnimation();
      setActiveId(catId);
      setFlyoutId(catId);
      setFlyoutAtHub(false);
      needsFlyToHubRef.current = true;
      return;
    }

    if (activeId !== catId) {
      setPendingSelectId(catId);
      resetSubsAnimation();
      setFlyoutMoveMs(FLYOUT_SWITCH_RETURN_MS);
      setSnapFlyoutPosition(false);
      setFlyoutAtHub(false);
      setActiveId(null);
    }
  };

  const handleFlyoutClose = (): void => {
    setPendingSelectId(null);
    resetSubsAnimation();
    setSnapFlyoutPosition(false);
    setFlyoutAtHub(false);
    setActiveId(null);
    setSelectedSubId(null);
    setSelectedTerms(new Set());
    setShowMaxWarning(false);
  };

  const handleSubClick = (subId: string): void => {
    setSelectedSubId((prev) => (prev === subId ? null : subId));
    setSelectedTerms(new Set());
    setShowMaxWarning(false);
  };

  const handleToggleLeaf = (label: string): void => {
    if (!selectedTerms.has(label) && selectedTerms.size >= MAX_SELECTION) {
      setShowMaxWarning(true);
      return;
    }
    setShowMaxWarning(false);
    setSelectedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const handleSearch = (): void => {
    if (onSearch && selectedCount > 0) {
      onSearch([...selectedTerms]);
      setSelectedTerms(new Set());
      setShowMaxWarning(false);
    }
  };

  const handleClearAll = (): void => {
    setSelectedTerms(new Set());
    setShowMaxWarning(false);
  };

  const closeTermsPanel = (): void => {
    setSelectedSubId(null);
    setSelectedTerms(new Set());
    setShowMaxWarning(false);
  };

  return (
    <div className="bg-surface border border-border rounded-[--radius-lg] w-full px-4 py-[0.9rem] min-h-0">
      <div className="flex items-center gap-2 flex-wrap mb-[0.35rem]">
        <h3 className="text-text-primary text-[0.9rem] font-semibold mb-0">Project term themes</h3>
        <HelpTooltip label={HELP_DASHBOARD_TERM_THEMES.label} placement="after">
          {HELP_DASHBOARD_TERM_THEMES.body}
        </HelpTooltip>
      </div>
      <p className="text-text-secondary text-[0.75rem] leading-[1.45] m-0 mb-2">
        Select a theme from the list, then choose a subcategory to browse terms.
      </p>

      {buckets.length === 0 ? (
        <p className="text-text-muted text-[0.875rem] mt-2 m-0">
          {payload.message ??
            "No theme data yet. Run: docker compose exec backend python indexer/build_project_term_theme_counts.py"}
        </p>
      ) : (
        <div className="flex w-full min-h-[24rem] lg:min-h-[28rem] flex-col lg:flex-row items-start gap-3 overflow-hidden">
          <div
            className="relative shrink-0 min-w-0 transition-[grid-template-columns] ease-in-out"
            style={{
              minHeight: listHeightPx,
              display: "grid",
              gridTemplateColumns: expandGridColumn
                ? `13.5rem minmax(${EXPAND_COL_MIN}, max-content)`
                : "13.5rem 0fr",
              transitionDuration: `${PANEL_MS}ms`,
              transitionProperty: "grid-template-columns",
            }}
          >
            <nav
              ref={listRef}
              className={cn("flex flex-col gap-5 min-w-0", LIST_WIDTH_CLASS)}
              aria-label="Theme categories"
            >
              {catNodes.map(({ cat, hue }) => (
                <CategoryListButton
                  key={cat.id}
                  label={cat.label}
                  hue={hue}
                  hidden={flyoutId === cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                />
              ))}
            </nav>

            {flyoutNode && flyoutIndex >= 0 && listWidthPx > 0 && (
              <CategoryFlyout
                key={flyoutId}
                ref={flyoutRef}
                label={flyoutNode.cat.label}
                hue={flyoutNode.hue}
                listIndex={flyoutIndex}
                listCount={catNodes.length}
                atHub={flyoutAtHub}
                listWidthPx={listWidthPx}
                snapPosition={snapFlyoutPosition}
                moveMs={flyoutMoveMs}
                onClose={handleFlyoutClose}
                onTransitionEnd={handleFlyoutTransitionEnd}
              />
            )}

            <div
              className={cn(
                "flex flex-col overflow-hidden min-w-0 transition-opacity ease-in-out",
                expansionOpen ? "opacity-100" : "opacity-0 pointer-events-none",
              )}
              style={{ transitionDuration: `${PANEL_MS}ms`, height: listHeightPx }}
              aria-hidden={!expansionOpen}
            >
              {showSubs && activeCatNode && (
                <div className="h-full max-h-[32rem]">
                  {(() => {
                    const { cat, hue, box } = activeCatNode;
                    const displayBox = expandBox(box, 4);
                    const subs: TermNode[] = cat.children ?? [];
                    const maxSubHalfW = SUB_NODE_HALF_W + 2;
                    const layout = expandLayoutMetrics(
                      displayBox.halfH,
                      listWidthPx,
                      subs.length,
                      maxSubHalfW,
                      catNodes.length,
                    );
                    const subPositions = subcatListPositions(
                      LIST_HUB_GAP_PX,
                      listWidthPx,
                      layout.hubY,
                      subs.length,
                    );
                    const subLabelFontSize = svgFontSizeInUserUnits(
                      SUB_FONT_PX,
                      layout.viewBoxWidth,
                      layout.svgW,
                    );

                    return (
                      <svg
                        viewBox={layout.viewBox}
                        preserveAspectRatio="xMinYMid meet"
                        className="block h-full"
                        style={{ width: layout.svgW, minWidth: layout.svgW }}
                        aria-label={`${cat.label} subcategories`}
                      >
                        <g>
                        {subPositions.length > 0 && (() => {
                          const subBoxes = subs.map((sub) =>
                            subNodeBox(selectedSubId === sub.id),
                          );
                          const busPath = subcatBusConnectorPath(
                            LIST_HUB_GAP_PX,
                            listWidthPx,
                            layout.hubY,
                            subPositions,
                            subBoxes,
                          );
                          return (
                            <path
                              d={busPath}
                              fill="none"
                              pathLength={1}
                              stroke={`hsl(${hue} 38% 62%)`}
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{
                                strokeDasharray: 1,
                                strokeDashoffset: subsAnimatedIn ? 0 : 1,
                                opacity: subsAnimatedIn ? 0.9 : 0,
                                transition: subsAnimatedIn
                                  ? `stroke-dashoffset ${SUB_OPEN_MS}ms ${SUB_OPEN_EASE}, opacity ${SUB_OPEN_MS * 0.45}ms ease`
                                  : "none",
                                pointerEvents: "none",
                              }}
                            />
                          );
                        })()}

                        {subs.map((sub, si) => {
                          const [sx, sy] = subPositions[si];
                          const subLines = splitLabel(sub.label, SUB_LABEL_MAX_CHARS);
                          const isSubSelected = selectedSubId === sub.id;
                          const subBox = subNodeBox(isSubSelected);
                          const animDelay = subOpenDelay(si);

                          return (
                            <g
                              key={sub.id}
                              style={{
                                cursor: "pointer",
                                opacity: subsAnimatedIn ? 1 : 0,
                                transform: subsAnimatedIn
                                  ? "scale(1)"
                                  : `scale(${SUB_NODE_SCALE_HIDDEN})`,
                                transformOrigin: `${sx}px ${sy}px`,
                                transformBox: "fill-box",
                                transition: subsAnimatedIn
                                  ? `opacity ${SUB_OPEN_MS * 0.5}ms ease ${animDelay}, transform ${SUB_OPEN_MS}ms ${SUB_OPEN_EASE} ${animDelay}`
                                  : "none",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSubClick(sub.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleSubClick(sub.id);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              aria-label={`${sub.label} subcategory`}
                              aria-pressed={isSubSelected}
                            >
                              <ThemeRect
                                cx={sx}
                                cy={sy}
                                box={subBox}
                                cornerRx={pillCornerRadius(subBox)}
                                fill={`hsl(${hue} ${isSubSelected ? 35 : 28}% ${isSubSelected ? 82 : 88}%)`}
                                stroke={
                                  isSubSelected
                                    ? `hsl(${hue} 55% 42%)`
                                    : `hsl(${hue} 35% 68%)`
                                }
                                strokeWidth={isSubSelected ? 2 : 1.2}
                                ariaLabel={sub.label}
                                tabIndex={-1}
                              />
                              <InsideLabel
                                x={sx}
                                y={sy}
                                lines={subLines}
                                fontSize={subLabelFontSize}
                                fontWeight={700}
                                fill={`hsl(${hue} 40% 24%)`}
                              />
                            </g>
                          );
                        })}
                        </g>
                      </svg>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          <div
            className={cn(
              "flex flex-col min-w-0 border-border overflow-hidden",
              "transition-[flex-basis,width,opacity,transform] ease-in-out",
              panelOpen
                ? "flex-1 lg:flex-[0.95] lg:max-w-[20rem] opacity-100 translate-x-0 max-lg:mt-0 max-lg:border max-lg:rounded-[--radius-md]"
                : "flex-[0] w-0 opacity-0 translate-x-4 pointer-events-none border-0 max-lg:max-h-0",
            )}
            style={{ transitionDuration: `${PANEL_MS}ms` }}
            aria-hidden={!panelOpen}
          >
            {selectedSub && activeCatNode && (
              <aside
                className="h-full w-full min-w-[17.5rem] border border-border rounded-[--radius-md] bg-surface-hover/50 flex flex-col max-h-[32rem] lg:max-h-[520px] shadow-sm transition-[opacity,transform] ease-out"
                style={{
                  transitionDuration: `${PANEL_MS}ms`,
                  opacity: panelOpen ? 1 : 0,
                  transform: panelOpen ? "translateX(0)" : "translateX(12px)",
                }}
                aria-label={`Terms in ${selectedSub.label}`}
              >
                <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-border shrink-0">
                  <div className="min-w-0">
                    <p className="text-[0.65rem] uppercase tracking-wide text-text-muted m-0 font-semibold">
                      {activeCatNode.cat.label}
                    </p>
                    <h4 className="text-text-primary text-[0.85rem] font-semibold m-0 leading-snug">
                      {selectedSub.label}
                    </h4>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 bg-transparent border-none text-text-muted cursor-pointer text-[1.1rem] leading-none px-1 hover:text-text-primary"
                    onClick={closeTermsPanel}
                    aria-label="Close terms panel"
                  >
                    ×
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
                  {leafTerms.length === 0 ? (
                    <p className="text-text-muted text-[0.8rem] m-0">No terms in this subcategory.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {leafRows.map((row, rowIndex) => (
                        <div key={rowIndex} className="grid grid-cols-3 gap-2">
                          {row.map((leaf) => {
                            const isSelected = selectedTerms.has(leaf.label);
                            return (
                              <button
                                key={leaf.id}
                                type="button"
                                className={cn(
                                  leafPillBase,
                                  isSelected && "bg-accent text-white border-accent",
                                )}
                                onClick={() => handleToggleLeaf(leaf.label)}
                                aria-pressed={isSelected}
                                title={
                                  leaf.weight != null
                                    ? `${leaf.weight.toLocaleString()} corpus hits`
                                    : undefined
                                }
                              >
                                {isSelected && "✓ "}
                                {leaf.label}
                              </button>
                            );
                          })}
                          {row.length < 3 &&
                            Array.from({ length: 3 - row.length }).map((_, padIndex) => (
                              <span key={`pad-${padIndex}`} className="min-h-[2rem]" aria-hidden />
                            ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="shrink-0 px-3 py-2 border-t border-border">
                  {showMaxWarning && (
                    <p className="text-[0.75rem] text-text-muted m-0 mb-2">
                      Maximum {MAX_SELECTION} terms
                    </p>
                  )}
                  {selectedCount > 0 && onSearch && (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        className="w-full bg-accent text-white border-none rounded-sm px-3 py-[0.38rem] font-sans text-[13px] font-medium cursor-pointer transition-[background] duration-150 hover:bg-accent-hover"
                        onClick={handleSearch}
                      >
                        Search {selectedCount} term{selectedCount > 1 ? "s" : ""}
                      </button>
                      <button
                        type="button"
                        className="w-full bg-transparent border-none text-accent-text cursor-pointer text-[0.8rem] underline py-0 hover:text-text-primary"
                        onClick={handleClearAll}
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                  {selectedCount === 0 && (
                    <p className="text-[0.72rem] text-text-muted m-0 text-center">
                      Select terms to search
                    </p>
                  )}
                </div>
              </aside>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
