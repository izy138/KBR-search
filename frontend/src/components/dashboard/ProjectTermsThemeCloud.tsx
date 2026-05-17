import type { ProjectTermThemeCloudResponse, ThemeBucket } from "../../api";

interface ProjectTermsThemeCloudProps {
  payload: ProjectTermThemeCloudResponse;
}

const HUES = [210, 160, 280, 25, 130, 340, 55, 190];


export default function ProjectTermsThemeCloud({ payload }: ProjectTermsThemeCloudProps) {
  const buckets: ThemeBucket[] = payload.buckets ?? [];
  const maxW = Math.max(...buckets.map((b) => b.weight), 1);

  return (
    <div className="bg-surface border border-border rounded-[--radius-lg] w-full px-4 py-[0.9rem] min-h-0">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-[0.35rem]">
        <h3 className="text-text-primary text-[0.9rem] font-semibold mb-0">Project term themes</h3>
      </div>
      <p className="text-text-secondary text-[0.75rem] leading-[1.45] m-0 mb-2">
        How many times was a term used in a project?
      </p>
      {buckets.length === 0 ? (
        <p className="text-text-muted text-[0.875rem] mt-2 m-0">
          {payload.message ??
            "No theme data yet. Run the embedding theme cell in proj_data_analysis.ipynb — it writes project_term_theme_counts.json next to the notebook — then reload."}
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-x-[0.65rem] gap-y-[0.55rem] px-2 pt-4 pb-5 min-h-32" aria-label="Theme word cloud">
          {buckets.map((b, i) => {
            const t = b.weight / maxW;
            const fontRem = 0.95 + t * 1.65;
            const hue = HUES[i % HUES.length];
            return (
              <span
                key={b.label}
                className="inline-flex items-baseline gap-[0.35rem] font-semibold leading-[1.2] px-[0.65rem] py-[0.35rem] rounded-[--radius-md] border border-border shadow-sm"
                style={{
                  fontSize: `${fontRem}rem`,
                  color: `hsl(${hue} 48% 32%)`,
                  backgroundColor: `hsl(${hue} 42% 96%)`,
                }}
                title={`${b.weight.toLocaleString()} term hits`}
              >
                {b.label}
                <span className="text-[0.68em] font-medium opacity-85">{b.weight.toLocaleString()}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
