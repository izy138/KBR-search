import type { ProjectYearVariant, SearchResultRecord } from "../api";

function normalizeCoreNum(core: string): string {
  return core.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseFy(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseProjectId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function recurrenceGroupKey(record: SearchResultRecord): string {
  const titleRaw = record.PROJECT_TITLE ?? record.title ?? record.project_title;
  if (typeof titleRaw === "string" && titleRaw.trim()) {
    return `title:${normalizeTitle(titleRaw)}`;
  }
  const coreRaw = record.CORE_PROJECT_NUM;
  if (typeof coreRaw === "string" && coreRaw.trim()) {
    return `core:${normalizeCoreNum(coreRaw)}`;
  }
  const id = record._id ?? record.id;
  return `id:${id ?? ""}`;
}

function toYearVariant(record: SearchResultRecord): ProjectYearVariant | null {
  const projectId = parseProjectId(record._id ?? record.id);
  if (!projectId) return null;
  return {
    project_id: projectId,
    fy: parseFy(record.FY),
    application_id: typeof record.APPLICATION_ID === "number" ? record.APPLICATION_ID : undefined,
  };
}

function normalizeYearVariant(raw: unknown): ProjectYearVariant | null {
  if (raw == null || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const projectId = parseProjectId(item.project_id);
  if (!projectId) return null;
  return {
    project_id: projectId,
    fy: parseFy(item.fy),
    application_id: typeof item.application_id === "number" ? item.application_id : undefined,
  };
}

function appendYearVariant(
  variants: ProjectYearVariant[],
  variant: ProjectYearVariant,
): void {
  if (variants.some((existing) => existing.project_id === variant.project_id)) return;
  if (variant.fy != null && variants.some((existing) => existing.fy === variant.fy)) return;
  variants.push(variant);
}

function dedupeYearVariants(variants: ProjectYearVariant[]): ProjectYearVariant[] {
  const byKey = new Map<string, ProjectYearVariant>();
  for (const variant of variants) {
    const key = variant.fy != null ? `fy:${variant.fy}` : `id:${variant.project_id}`;
    if (!byKey.has(key)) {
      byKey.set(key, variant);
    }
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.fy == null && b.fy == null) return 0;
    if (a.fy == null) return 1;
    if (b.fy == null) return -1;
    return a.fy - b.fy;
  });
}

function getYearVariants(record: SearchResultRecord): ProjectYearVariant[] {
  const raw = record.year_variants;
  if (Array.isArray(raw)) {
    const fromArray = raw
      .map((item) => normalizeYearVariant(item))
      .filter((item): item is ProjectYearVariant => item != null);
    if (fromArray.length > 0) return fromArray;
  }
  const single = toYearVariant(record);
  return single ? [single] : [];
}

function mergeSimilarGroupInto(
  groups: Map<string, SearchResultRecord>,
  primaryKey: string,
  otherKey: string,
): void {
  const primary = groups.get(primaryKey);
  const other = groups.get(otherKey);
  if (!primary || !other) return;

  const variants = [...getYearVariants(primary)];
  for (const variant of getYearVariants(other)) {
    appendYearVariant(variants, variant);
  }

  const otherScore = typeof other._score === "number" ? other._score : 0;
  const primaryScore = typeof primary._score === "number" ? primary._score : 0;
  const base = otherScore > primaryScore ? { ...other } : { ...primary };
  base.year_variants = dedupeYearVariants(variants);
  groups.set(primaryKey, base);
  groups.delete(otherKey);
}

/** Collapse recurring fiscal-year rows into one similar-project hit with year_variants. */
export function groupSimilarNeighbors(neighbors: SearchResultRecord[]): SearchResultRecord[] {
  const groups = new Map<string, SearchResultRecord>();
  const order: string[] = [];

  for (const record of neighbors) {
    const key = recurrenceGroupKey(record);
    const variant = toYearVariant(record);
    const existing = groups.get(key);

    if (!existing) {
      const grouped: SearchResultRecord = { ...record };
      const variants = dedupeYearVariants([
        ...getYearVariants(record),
        ...(variant ? [variant] : []),
      ]);
      if (variants.length > 0) {
        grouped.year_variants = variants;
      }
      groups.set(key, grouped);
      order.push(key);
      continue;
    }

    const variants = [...getYearVariants(existing)];
    if (variant) {
      appendYearVariant(variants, variant);
    }
    const recordScore = typeof record._score === "number" ? record._score : 0;
    const existingScore = typeof existing._score === "number" ? existing._score : 0;
    const base = recordScore > existingScore ? { ...record } : { ...existing };
    base.year_variants = dedupeYearVariants(variants);
    groups.set(key, base);
  }

  const coreIndex = new Map<string, string>();
  const mergedOrder: string[] = [];
  for (const key of order) {
    if (!groups.has(key)) continue;
    const grouped = groups.get(key)!;
    const coreRaw = grouped.CORE_PROJECT_NUM;
    const normCore =
      typeof coreRaw === "string" && coreRaw.trim() ? normalizeCoreNum(coreRaw) : null;
    if (normCore && coreIndex.has(normCore)) {
      mergeSimilarGroupInto(groups, coreIndex.get(normCore)!, key);
      continue;
    }
    if (normCore) {
      coreIndex.set(normCore, key);
    }
    mergedOrder.push(key);
  }

  return mergedOrder.map((key) => {
    const grouped = groups.get(key)!;
    const variants = dedupeYearVariants(getYearVariants(grouped));
    return { ...grouped, year_variants: variants };
  });
}
