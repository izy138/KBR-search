import { useEffect, useState } from "react";
import { getActivityProjectCompareData, type ActivityProjectCompareDataPoint } from "../../api";
import BarChartPanel from "../charts/BarChartPanel";

type ProjectActivityCompareChartProps = {
  projectId: string;
  activityId: string;
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const truncateLabel = (value: string, maxLength: number = 28): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;

export default function ProjectActivityCompareChart({ projectId, activityId }: ProjectActivityCompareChartProps) {
  const [data, setData] = useState<ActivityProjectCompareDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void getActivityProjectCompareData(projectId, activityId, 20)
      .then((payload) => {
        if (cancelled) return;
        setData(payload.data ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setData([]);
        setError("Unable to load activity analytics right now.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activityId, projectId]);

  if (loading) {
    return (
      <section className="project-details-section">
        <h2>Related Activity Analytics</h2>
        <p className="project-details-placeholder">Loading chart...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="project-details-section">
        <h2>Related Activity Analytics</h2>
        <p className="project-details-placeholder">{error}</p>
      </section>
    );
  }

  if (data.length === 0) {
    return (
      <section className="project-details-section">
        <h2>Related Activity Analytics</h2>
        <p className="project-details-placeholder">
          No comparable projects found for activity {activityId}.
        </p>
      </section>
    );
  }

   const hasFundingData = data.some((item) => item.total_funding > 0);
  if (!hasFundingData) {
    return (
      <section className="project-details-section">
        <h2>Related Activity Analytics</h2>
        <p className="project-details-placeholder">
          No comparable projects with available total cost for activity {activityId}.
        </p>
      </section>
    );
  }


  const chartData: Array<Record<string, unknown>> = data.map((item) => ({
    ...item,
    short_label: truncateLabel(item.label),
    full_label: item.label,
  }));

  return (
    <section className="project-details-section">
      <BarChartPanel
        title={`Selected Project vs  Descending Order Activity ${activityId}`}
        data={chartData}
        dataKey="total_funding"
        labelKey="short_label"
        tooltipLabelKey="full_label"
        layout="horizontal"
        formatter={formatCurrency}
        height={465}
      />
    </section>
  );
}
