import { type FC } from "react";
import type { AnalyticsCategory } from "../../api";

type ChartsProps = {
  data: AnalyticsCategory[];
  visible: boolean;
  onLoad: () => void;
};

const Charts: FC<ChartsProps> = ({ data, visible, onLoad }) => {
  if (!visible) {
    return (
      <div className="bg-surface border border-border rounded-[--radius-lg] p-8 text-center text-text-muted text-[13px] mb-6">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="block mx-auto mb-2 text-text-muted"
          aria-hidden="true"
        >
          <rect x="3" y="12" width="4" height="9" rx="1" />
          <rect x="10" y="7" width="4" height="14" rx="1" />
          <rect x="17" y="3" width="4" height="18" rx="1" />
        </svg>
        <button
          type="button"
          onClick={onLoad}
          className="bg-transparent border-none text-accent cursor-pointer font-[inherit] text-[13px] font-medium p-0"
        >
          Load analytics →
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return null;
  }

  const maxValue = Math.max(...data.map((point) => point.value), 1);

  return (
    <div className="bg-surface border border-border rounded-[var(--radius-lg)] px-6 py-5 mb-6">
      <div className="sidebar-label mb-4">Top Categories</div>
      <div className="flex flex-col gap-2">
        {data.map((point) => (
          <div key={point.label} className="flex items-center gap-3 text-[13px]">
            <span className="min-w-[80px] text-text-secondary font-medium">{point.label}</span>
            <div className="flex-1 bg-bg rounded h-2 overflow-hidden">
              <div
                className="h-full bg-accent rounded transition-[width] duration-[400ms] ease-in-out"
                style={{ width: `${Math.round((point.value / maxValue) * 100)}%` }}
              />
            </div>
            <span className="min-w-[50px] text-right text-text-muted font-['DM_Mono',monospace] text-[12px]">
              {point.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Charts;
