import { useMemo } from "react";
import type { SearchResultRecord } from "../api";
import { recurrenceGroupKey } from "../utils/recurrenceGrouping";
import BarChartPanel from "./BarChartPanel";

type ProjectSimilarProjectsChartProps = {
  currentProject: SearchResultRecord;
  projectId: string;
  neighbors: SearchResultRecord[];
  loading: boolean;
  error: string;
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const truncateLabel = (value: string, maxLength: number = 28): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;

const FALLBACK_FILL_SELECTED = "#0f766e";
const FALLBACK_FILL_PEER = "#1a56db";

function resolveCssColor(cssVar: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return value || fallback;
}

function getSimilarChartBarFills(): { selected: string; peer: string } {
  return {
    selected: resolveCssColor("--green", FALLBACK_FILL_SELECTED),
    peer: resolveCssColor("--accent", FALLBACK_FILL_PEER),
  };
}

function toFunding(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildComparePoints(
  currentProject: SearchResultRecord,
  projectId: string,
  neighbors: SearchResultRecord[],
): Array<{
  project_id: string;
  label: string;
  total_funding: number;
  is_selected: boolean;
}> {
  const currentKey = recurrenceGroupKey(currentProject);
  const currentTitle = currentProject.PROJECT_TITLE ?? "Current project";
  const points: Array<{
    project_id: string;
    label: string;
    total_funding: number;
    is_selected: boolean;
  }> = [
    {
      project_id: projectId,
      label: `Selected: ${currentTitle}`,
      total_funding: toFunding(currentProject.TOTAL_COST),
      is_selected: true,
    },
  ];

  for (const neighbor of neighbors) {
    const neighborId = neighbor._id ?? neighbor.id;
    if (neighborId != null && String(neighborId) === projectId) continue;
    if (recurrenceGroupKey(neighbor) === currentKey) continue;
    const title = neighbor.PROJECT_TITLE ?? "Untitled";
    points.push({
      project_id: neighborId != null ? String(neighborId) : title,
      label: title,
      total_funding: toFunding(neighbor.TOTAL_COST),
      is_selected: false,
    });
  }

  return points.sort((a, b) => b.total_funding - a.total_funding);
}

export default function ProjectSimilarProjectsChart({
  currentProject,
  projectId,
  neighbors,
  loading,
  error,
}: ProjectSimilarProjectsChartProps): JSX.Element {
  const barFills = getSimilarChartBarFills();
  const chartData = useMemo(() => {
    const fills = getSimilarChartBarFills();
    return buildComparePoints(currentProject, projectId, neighbors).map((item) => ({
      ...item,
      short_label: truncateLabel(item.label),
      full_label: item.label,
      bar_fill: item.is_selected ? fills.selected : fills.peer,
    }));
  }, [currentProject, projectId, neighbors]);

  if (loading) {
    return (
      <section className="project-details-section">
        <h2>Similar Projects — Award Comparison</h2>
        <p className="project-details-placeholder">Loading chart…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="project-details-section">
        <h2>Similar Projects — Award Comparison</h2>
        <p className="project-details-placeholder">{error}</p>
      </section>
    );
  }

  if (chartData.length === 0) {
    return (
      <section className="project-details-section">
        <h2>Similar Projects — Award Comparison</h2>
        <p className="project-details-placeholder">No similar projects to compare.</p>
      </section>
    );
  }

  const hasFundingData = chartData.some((item) => item.total_funding > 0);
  if (!hasFundingData) {
    return (
      <section className="project-details-section">
        <h2>Similar Projects — Award Comparison</h2>
        <p className="project-details-placeholder">
          Similar projects were found, but none have award amounts available to chart.
        </p>
      </section>
    );
  }

  const peerCount = chartData.filter((item) => !item.is_selected).length;

  return (
    <section className="project-details-section project-similar-chart-section">
      <BarChartPanel
        title={`Selected Project vs ${peerCount} Similar Project${peerCount === 1 ? "" : "s"} (by total award)`}
        headerEnd={
          <div className="project-similar-chart-legend" aria-label="Chart legend">
            <span className="project-similar-chart-legend-item">
              <span
                className="project-similar-chart-legend-swatch project-similar-chart-legend-swatch--selected"
                style={{ backgroundColor: barFills.selected }}
              />
              Selected project
            </span>
            <span className="project-similar-chart-legend-item">
              <span
                className="project-similar-chart-legend-swatch"
                style={{ backgroundColor: barFills.peer }}
              />
              Similar projects
            </span>
          </div>
        }
        data={chartData}
        dataKey="total_funding"
        labelKey="short_label"
        tooltipLabelKey="full_label"
        barFillKey="bar_fill"
        layout="horizontal"
        formatter={formatCurrency}
        height={465}
      />
    </section>
  );
}
