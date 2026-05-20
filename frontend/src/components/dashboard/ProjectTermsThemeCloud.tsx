import { useMemo, useState, type ReactElement } from "react";
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

const SVG_W = 580;
const SVG_H = 520;
const CX = SVG_W / 2;
const CY = SVG_H / 2;
const R_CAT_RX = 220;
const R_CAT_RY = 145;
const R_SUB = 155;
const SUB_FAN_DEG = 210;
const CAT_REPEL_GAP = 12;
const CAT_REPEL_ITERATIONS = 20;
const CAT_MAX_SHIFT = 110;
const CAT_PEER_SHRINK = 0.78;
const CAT_ACTIVE_RADIUS_BONUS = 4;
const SUB_BASE_SCALE = 0.8;
const SUB_ACTIVE_SCALE = 1.28;
const LAYOUT_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const LAYOUT_MS = 500;
const SUB_OPEN_MS = 580;
const SUB_STAGGER_MS = 55;
const SUB_OPEN_EASE = "cubic-bezier(0.34, 1.15, 0.64, 1)";

const leafPillBase =
  "inline-flex items-center justify-center min-h-[2rem] px-2 py-1 rounded-sm bg-tag-bg text-tag-text border border-border text-[0.75rem] leading-tight text-center cursor-pointer transition-[background,border-color,color] duration-150 hover:border-border-strong";

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
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

function wrapLabelWordsFull(label: string, maxCharsPerLine: number): string[] {
  const normalized = label.trim();
  if (normalized.includes(" & ")) {
    return normalized
      .split(" & ")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (normalized.length <= maxCharsPerLine) {
    return [normalized];
  }
  const words = normalized.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [normalized];
}

type CircleLabelFit = {
  lines: string[];
  fontSize: number;
  radius: number;
};

function textFitsInCircle(
  lines: string[],
  fontSize: number,
  radius: number,
  pad: number,
  lineHeightFactor = 1.12,
): boolean {
  const lineHeight = fontSize * lineHeightFactor;
  const maxChars = Math.max(...lines.map((line) => line.length), 1);
  const halfW = maxChars * fontSize * 0.32;
  const halfH = (lines.length * lineHeight) / 2;
  return Math.max(halfW, halfH) + pad <= radius;
}

function fitSubcategoryInCircle(
  label: string,
  weightRatio: number,
  selected: boolean,
  sizeScale = 1,
): CircleLabelFit {
  const pad = 6 * sizeScale;
  const minR = 18 * sizeScale;
  const maxR = 46 * sizeScale;
  const weightR = (16 + weightRatio * 6) * sizeScale;
  const minFont = 7 * sizeScale;
  const maxFont = 10.5 * sizeScale;

  for (let fontSize = maxFont; fontSize >= minFont; fontSize -= 0.25) {
    const maxChars = Math.max(9, Math.round(fontSize * 1.95));
    const lines = wrapLabelWordsFull(label, maxChars);
    const textR = radiusForInsideText(lines, fontSize, minR, maxR, pad);
    const radius = clamp(Math.max(textR, weightR), minR, maxR);
    if (textFitsInCircle(lines, fontSize, radius, pad, 1.14)) {
      const finalR = selected ? radius + 2 * sizeScale : radius;
      return { lines, fontSize, radius: finalR };
    }
  }

  const lines = wrapLabelWordsFull(label, Math.max(9, Math.round(10 * sizeScale)));
  const fontSize = minFont;
  const radius = clamp(
    Math.max(radiusForInsideText(lines, fontSize, minR, maxR, pad), weightR),
    minR,
    maxR,
  );
  return { lines, fontSize, radius: selected ? radius + 2 * sizeScale : radius };
}

function radiusForInsideText(
  lines: string[],
  fontSize: number,
  minR: number,
  maxR: number,
  pad = 8,
): number {
  const lineHeight = fontSize * 1.2;
  const maxChars = Math.max(...lines.map((l) => l.length), 1);
  const halfW = maxChars * fontSize * 0.32;
  const halfH = (lines.length * lineHeight) / 2;
  return clamp(Math.max(halfW, halfH) + pad, minR, maxR);
}

function catNodeRadius(weight: number, maxWeight: number, lines: string[], fontSize: number): number {
  const t = maxWeight > 0 ? weight / maxWeight : 0;
  const weightR = 32 + t * 22;
  const textR = radiusForInsideText(lines, fontSize, 32, 72, 10);
  return Math.max(weightR, textR);
}

function categoryDisplayMetrics(
  baseR: number,
  baseFontSize: number,
  isActive: boolean,
  selectionActive: boolean,
): { radius: number; fontSize: number } {
  if (!selectionActive) {
    return { radius: baseR, fontSize: baseFontSize };
  }
  if (isActive) {
    return { radius: baseR + CAT_ACTIVE_RADIUS_BONUS, fontSize: baseFontSize };
  }
  return {
    radius: baseR * CAT_PEER_SHRINK,
    fontSize: baseFontSize * CAT_PEER_SHRINK,
  };
}

function radialPos(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function ellipsePos(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  angleDeg: number,
): [number, number] {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return [cx + rx * Math.cos(rad), cy + ry * Math.sin(rad)];
}

function outwardAngleDeg(cx: number, cy: number, x: number, y: number): number {
  return (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
}

function edgePoint(
  cx: number,
  cy: number,
  radius: number,
  towardX: number,
  towardY: number,
): [number, number] {
  const dx = towardX - cx;
  const dy = towardY - cy;
  const len = Math.hypot(dx, dy) || 1;
  return [cx + (dx / len) * radius, cy + (dy / len) * radius];
}

function connectorPath(
  catX: number,
  catY: number,
  catR: number,
  subX: number,
  subY: number,
  subR: number,
): string {
  const [x1, y1] = edgePoint(catX, catY, catR, subX, subY);
  const [x2, y2] = edgePoint(subX, subY, subR, catX, catY);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = subX - catX;
  const dy = subY - catY;
  const len = Math.hypot(dx, dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  const bulge = Math.min(28, len * 0.12);
  const cx = mx + perpX * bulge;
  const cy = my + perpY * bulge;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

function subOpenDelay(index: number, isActive: boolean): string {
  if (isActive) {
    return `${index * SUB_STAGGER_MS}ms`;
  }
  return `${Math.max(0, (5 - index) * 30)}ms`;
}

type CatNodeLayout = {
  cat: TermNode;
  x: number;
  y: number;
  angleDeg: number;
  hue: number;
  r: number;
  lines: string[];
};

function fitSubcategoryNode(
  sub: TermNode,
  subMaxW: number,
  selected: boolean,
  sizeScale = 1,
): CircleLabelFit {
  const weightRatio = subMaxW > 0 ? (sub.weight ?? 0) / subMaxW : 0;
  return fitSubcategoryInCircle(sub.label, weightRatio, selected, sizeScale);
}

function subcatPositions(
  catX: number,
  catY: number,
  count: number,
  outwardDeg: number,
): [number, number][] {
  if (count === 0) return [];
  if (count === 1) {
    return [radialPos(catX, catY, R_SUB, outwardDeg)];
  }
  const half = SUB_FAN_DEG / 2;
  const step = SUB_FAN_DEG / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const angle = outwardDeg - half + i * step;
    return radialPos(catX, catY, R_SUB, angle);
  });
}

type CircleObstacle = { x: number; y: number; r: number };

function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
  gap: number,
): boolean {
  return Math.hypot(ax - bx, ay - by) < ar + br + gap;
}

function pushCircleAway(
  x: number,
  y: number,
  obstacle: CircleObstacle,
  radius: number,
  gap: number,
): [number, number] {
  const dx = x - obstacle.x;
  const dy = y - obstacle.y;
  const dist = Math.hypot(dx, dy) || 1;
  const minDist = radius + obstacle.r + gap;
  if (dist >= minDist) {
    return [x, y];
  }
  const push = minDist - dist;
  return [x + (dx / dist) * push, y + (dy / dist) * push];
}

function clampShiftFromBase(
  x: number,
  y: number,
  baseX: number,
  baseY: number,
  maxShift: number,
): [number, number] {
  const dx = x - baseX;
  const dy = y - baseY;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxShift) {
    return [x, y];
  }
  const scale = maxShift / dist;
  return [baseX + dx * scale, baseY + dy * scale];
}

function subObstaclesForActiveCategory(
  active: CatNodeLayout,
  selectedSubId: string | null,
): CircleObstacle[] {
  const subs = active.cat.children ?? [];
  if (subs.length === 0) return [];

  const subMaxW = Math.max(...subs.map((s) => s.weight ?? 0), 1);
  const positions = subcatPositions(active.x, active.y, subs.length, active.angleDeg);

  return subs.map((sub, si) => {
    const [sx, sy] = positions[si];
    const fit = fitSubcategoryNode(
      sub,
      subMaxW,
      selectedSubId === sub.id,
      SUB_ACTIVE_SCALE * SUB_BASE_SCALE,
    );
    return { x: sx, y: sy, r: fit.radius };
  });
}

function adjustCategoriesForActiveSubs(
  nodes: CatNodeLayout[],
  activeId: string | null,
  selectedSubId: string | null,
): CatNodeLayout[] {
  if (!activeId) return nodes;

  const active = nodes.find((node) => node.cat.id === activeId);
  if (!active) return nodes;

  const subObstacles = subObstaclesForActiveCategory(active, selectedSubId);
  if (subObstacles.length === 0) return nodes;

  const positions = nodes.map((node) => ({
    x: node.x,
    y: node.y,
    baseX: node.x,
    baseY: node.y,
  }));

  const activeIndex = nodes.findIndex((node) => node.cat.id === activeId);

  for (let iter = 0; iter < CAT_REPEL_ITERATIONS; iter += 1) {
    let moved = false;

    for (let i = 0; i < nodes.length; i += 1) {
      if (i === activeIndex) continue;

      const node = nodes[i];
      const pos = positions[i];
      let { x, y } = pos;
      const radius = node.r * CAT_PEER_SHRINK;

      for (const obstacle of subObstacles) {
        const [nx, ny] = pushCircleAway(x, y, obstacle, radius, CAT_REPEL_GAP);
        if (nx !== x || ny !== y) {
          x = nx;
          y = ny;
          moved = true;
        }
      }

      for (let j = i + 1; j < nodes.length; j += 1) {
        if (j === activeIndex) continue;
        const other = nodes[j];
        const otherPos = positions[j];
        const otherR = other.r * CAT_PEER_SHRINK;
        if (
          circlesOverlap(x, y, radius, otherPos.x, otherPos.y, otherR, CAT_REPEL_GAP)
        ) {
          const dx = x - otherPos.x;
          const dy = y - otherPos.y;
          const dist = Math.hypot(dx, dy) || 1;
          const minDist = radius + otherR + CAT_REPEL_GAP;
          const push = (minDist - dist) / 2;
          x += (dx / dist) * push;
          y += (dy / dist) * push;
          otherPos.x -= (dx / dist) * push;
          otherPos.y -= (dy / dist) * push;
          moved = true;
        }
      }

      [x, y] = clampShiftFromBase(x, y, pos.baseX, pos.baseY, CAT_MAX_SHIFT);
      pos.x = x;
      pos.y = y;
    }

    if (!moved) break;
  }

  return nodes.map((node, i) => ({
    ...node,
    x: positions[i].x,
    y: positions[i].y,
  }));
}

function expandBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  x: number,
  y: number,
  radius: number,
  extraBottom = 0,
): void {
  bounds.minX = Math.min(bounds.minX, x - radius);
  bounds.maxX = Math.max(bounds.maxX, x + radius);
  bounds.minY = Math.min(bounds.minY, y - radius);
  bounds.maxY = Math.max(bounds.maxY, y + radius + extraBottom);
}

function computeViewBox(
  catNodes: CatNodeLayout[],
  activeId: string | null,
  selectedSubId: string | null,
  catFontSize: number,
  padding = 28,
): string {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  const selectionActive = activeId !== null;

  for (const node of catNodes) {
    const isActive = activeId === node.cat.id;
    const { radius: displayR, fontSize: displayFontSize } = categoryDisplayMetrics(
      node.r,
      catFontSize,
      isActive,
      selectionActive,
    );
    const catLabelPad = node.lines.length * displayFontSize * 1.15 + 6;
    expandBounds(bounds, node.x, node.y, displayR, catLabelPad);

    if (!isActive) continue;

    const subs = node.cat.children ?? [];
    const subPositions = subcatPositions(node.x, node.y, subs.length, node.angleDeg);
    const subMaxW = Math.max(...subs.map((s) => s.weight ?? 0), 1);

    subs.forEach((sub, si) => {
      const [sx, sy] = subPositions[si];
      const fit = fitSubcategoryNode(
        sub,
        subMaxW,
        selectedSubId === sub.id,
        SUB_ACTIVE_SCALE * SUB_BASE_SCALE,
      );
      const subLabelPad = fit.lines.length * fit.fontSize * 1.12 + 4;
      expandBounds(bounds, sx, sy, fit.radius, subLabelPad);
    });
  }

  if (!Number.isFinite(bounds.minX)) {
    return `0 0 ${SVG_W} ${SVG_H}`;
  }

  const width = bounds.maxX - bounds.minX + padding * 2;
  const height = bounds.maxY - bounds.minY + padding * 2;
  return `${bounds.minX - padding} ${bounds.minY - padding} ${width} ${height}`;
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
  lineHeightFactor?: number;
};

function InsideLabel({
  x,
  y,
  lines,
  fontSize,
  fill,
  fontWeight = 500,
  visible = true,
  lineHeightFactor = 1.2,
}: InsideLabelProps): ReactElement {
  const lineHeight = fontSize * lineHeightFactor;
  const startDy = -((lines.length - 1) * lineHeight) / 2;

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      style={{
        fontSize: `${fontSize}px`,
        fill,
        fontWeight,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.25s, font-size 0.45s ease",
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

export default function ProjectTermsThemeCloud({ payload, onSearch }: Props): ReactElement {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());
  const [showMaxWarning, setShowMaxWarning] = useState(false);

  const rawTree: TermNode[] = (payload.tree ?? []).filter((n) => n.label !== "Low confidence");
  const buckets = (payload.buckets ?? []).filter((b) => b.label !== "Low confidence");

  const maxWeight = Math.max(...rawTree.map((n) => n.weight ?? 0), 1);
  const n = rawTree.length;
  const catFontSize = 12;

  const baseCatNodes = useMemo(
    () =>
      rawTree.map((cat, i) => {
        const placementDeg = (360 / n) * i;
        const [x, y] = ellipsePos(CX, CY, R_CAT_RX, R_CAT_RY, placementDeg);
        const angleDeg = outwardAngleDeg(CX, CY, x, y);
        const hue = HUES[i % HUES.length];
        const lines = splitLabel(cat.label, 13);
        const r = catNodeRadius(cat.weight ?? 0, maxWeight, lines, catFontSize);
        return { cat, x, y, angleDeg, hue, r, lines };
      }),
    [rawTree, n, maxWeight, catFontSize],
  );

  const catNodes = useMemo(
    () => adjustCategoriesForActiveSubs(baseCatNodes, activeId, selectedSubId),
    [baseCatNodes, activeId, selectedSubId],
  );

  const activeCatNode = catNodes.find((node) => node.cat.id === activeId);
  const selectedSub =
    activeCatNode?.cat.children?.find((sub) => sub.id === selectedSubId) ?? null;
  const leafTerms: TermNode[] = selectedSub?.children ?? [];
  const leafRows = chunkRows(leafTerms, 3);
  const selectedCount = selectedTerms.size;
  const panelOpen = selectedSub !== null;
  const viewBox = computeViewBox(catNodes, activeId, selectedSubId, catFontSize);

  const handleCategoryClick = (catId: string, isActive: boolean): void => {
    if (isActive) {
      setActiveId(null);
      setSelectedSubId(null);
      setSelectedTerms(new Set());
      setShowMaxWarning(false);
    } else {
      setActiveId(catId);
      setSelectedSubId(null);
      setSelectedTerms(new Set());
      setShowMaxWarning(false);
    }
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
        Click a category, then a subcategory to browse terms. 
        
      </p>

      {buckets.length === 0 ? (
        <p className="text-text-muted text-[0.875rem] mt-2 m-0">
          {payload.message ??
            "No theme data yet. Run: docker compose exec backend python indexer/build_project_term_theme_counts.py"}
        </p>
      ) : (
        <div className="flex w-full min-h-[28rem] lg:min-h-[32.5rem] flex-col lg:flex-row items-stretch overflow-hidden">
          <div
            className={cn(
              "flex flex-col items-stretch justify-center min-w-0 min-h-[22rem] max-h-[32.5rem] overflow-hidden",
              panelOpen ? "flex-[1.35] lg:pr-1 max-lg:min-h-[24rem]" : "flex-1 w-full",
            )}
            style={{ transition: `flex-basis ${LAYOUT_MS}ms ${LAYOUT_EASE}, width ${LAYOUT_MS}ms ${LAYOUT_EASE}` }}
          >
            <div className="w-full self-stretch min-h-[20rem] max-h-[32.5rem] h-full p-1 box-border">
              <svg
                viewBox={viewBox}
                preserveAspectRatio="xMidYMid meet"
                className="w-full h-full block max-w-full max-h-full"
                style={{ transition: `opacity ${LAYOUT_MS * 0.5}ms ${LAYOUT_EASE}` }}
                aria-label="Radial theme cloud"
              >
              {catNodes.map(({ cat, x, y, angleDeg, hue, r, lines }) => {
                const isActive = activeId === cat.id;
                const selectionActive = activeId !== null;
                const { radius: displayR, fontSize: displayCatFontSize } = categoryDisplayMetrics(
                  r,
                  catFontSize,
                  isActive,
                  selectionActive,
                );
                const subs: TermNode[] = cat.children ?? [];
                const subPositions = subcatPositions(0, 0, subs.length, angleDeg);
                const subMaxW = Math.max(...subs.map((s) => s.weight ?? 0), 1);
                const subSizeScale = (isActive ? SUB_ACTIVE_SCALE : 1) * SUB_BASE_SCALE;
                const groupTransition = `transform ${LAYOUT_MS}ms ${LAYOUT_EASE}`;

                return (
                  <g
                    key={cat.id}
                    style={{
                      transform: `translate(${x}px, ${y}px)`,
                      transition: groupTransition,
                    }}
                  >
                    <circle
                      cx={0}
                      cy={0}
                      r={displayR}
                      style={{
                        fill: `hsl(${hue} 42% ${isActive ? 82 : 90}%)`,
                        stroke: isActive ? `hsl(${hue} 55% 45%)` : `hsl(${hue} 30% 72%)`,
                        strokeWidth: isActive ? 2.5 : 1.5,
                        cursor: "pointer",
                        transition: `r ${SUB_OPEN_MS * 0.45}ms ${SUB_OPEN_EASE}, fill ${SUB_OPEN_MS * 0.45}ms ${LAYOUT_EASE}, stroke ${SUB_OPEN_MS * 0.45}ms ${LAYOUT_EASE}`,
                      }}
                      onClick={() => handleCategoryClick(cat.id, isActive)}
                      aria-label={cat.label}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handleCategoryClick(cat.id, isActive);
                        }
                      }}
                    />
                    <InsideLabel
                      x={0}
                      y={0}
                      lines={lines}
                      fontSize={displayCatFontSize}
                      fill={`hsl(${hue} 48% ${isActive ? 22 : 30}%)`}
                      fontWeight={isActive ? 700 : 600}
                    />

                    {subPositions.map(([sx, sy], si) => {
                      const sub = subs[si];
                      const subFit = fitSubcategoryNode(
                        sub,
                        subMaxW,
                        selectedSubId === sub.id,
                        subSizeScale,
                      );
                      const subR = subFit.radius;
                      const pathD = connectorPath(0, 0, displayR, sx, sy, subR);
                      const lineDelay = subOpenDelay(si, isActive);

                      return (
                        <path
                          key={`connector-${si}`}
                          d={pathD}
                          fill="none"
                          pathLength={1}
                          stroke={`hsl(${hue} 38% 62%)`}
                          strokeWidth={2}
                          strokeLinecap="round"
                          style={{
                            strokeDasharray: 1,
                            strokeDashoffset: isActive ? 0 : 1,
                            opacity: isActive ? 0.9 : 0,
                            transition: `stroke-dashoffset ${SUB_OPEN_MS}ms ${SUB_OPEN_EASE} ${lineDelay}, opacity ${SUB_OPEN_MS * 0.5}ms ease ${lineDelay}`,
                            pointerEvents: "none",
                          }}
                        />
                      );
                    })}

                    {subs.map((sub, si) => {
                      const [sx, sy] = subPositions[si];
                      const isSubSelected = selectedSubId === sub.id;
                      const subFit = fitSubcategoryNode(
                        sub,
                        subMaxW,
                        isSubSelected,
                        subSizeScale,
                      );
                      const { lines: subLines, fontSize: subLabelFont, radius: subR } = subFit;
                      const animDelay = subOpenDelay(si, isActive);

                      return (
                        <g
                          key={sub.id}
                          style={{
                            cursor: isActive ? "pointer" : "default",
                            opacity: isActive ? 1 : 0,
                            transform: isActive ? "scale(1)" : "scale(0.45)",
                            transformOrigin: `${sx}px ${sy}px`,
                            transformBox: "fill-box",
                            transition: `opacity ${SUB_OPEN_MS * 0.55}ms ease ${animDelay}, transform ${SUB_OPEN_MS}ms ${SUB_OPEN_EASE} ${animDelay}`,
                            pointerEvents: isActive ? "auto" : "none",
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
                          tabIndex={isActive ? 0 : -1}
                          aria-label={`${sub.label} subcategory`}
                          aria-pressed={isSubSelected}
                          aria-hidden={!isActive}
                        >
                          <circle
                            cx={sx}
                            cy={sy}
                            r={subR}
                            style={{
                              fill: `hsl(${hue} ${isSubSelected ? 35 : 28}% ${isSubSelected ? 82 : 88}%)`,
                              stroke: isSubSelected
                                ? `hsl(${hue} 55% 42%)`
                                : `hsl(${hue} 35% 68%)`,
                              strokeWidth: isSubSelected ? 2 : 1.2,
                              transition: `r 0.25s ease, fill 0.25s ease, stroke 0.25s ease`,
                            }}
                          />
                          <InsideLabel
                            x={sx}
                            y={sy}
                            lines={subLines}
                            fontSize={subLabelFont}
                            fill={`hsl(${hue} 48% 16%)`}
                            fontWeight={700}
                            visible={isActive}
                            lineHeightFactor={1.14}
                          />
                        </g>
                      );
                    })}
                  </g>
                );
              })}
              </svg>
            </div>
          </div>

          <div
            className={cn(
              "flex flex-col min-w-0 border-border overflow-hidden",
              "transition-[flex-basis,width,opacity,transform] ease-in-out",
              panelOpen
                ? "flex-1 lg:flex-[0.95] lg:max-w-[20rem] opacity-100 translate-x-0 max-lg:mt-3 max-lg:border max-lg:rounded-[--radius-md]"
                : "flex-[0] w-0 opacity-0 translate-x-4 pointer-events-none border-0 max-lg:max-h-0",
            )}
            style={{ transitionDuration: `${LAYOUT_MS}ms` }}
            aria-hidden={!panelOpen}
          >
            {selectedSub && activeCatNode && (
              <aside
                className="h-full w-full min-w-[17.5rem] border border-border rounded-[--radius-md] bg-surface-hover/50 flex flex-col max-h-[32rem] lg:max-h-[520px] shadow-sm transition-[opacity,transform] ease-out"
                style={{
                  transitionDuration: `${LAYOUT_MS}ms`,
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
