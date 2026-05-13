import type { ProjectTermThemeCloudResponse, ThemeBucket } from "../api";

interface ProjectTermsThemeCloudProps {
  payload: ProjectTermThemeCloudResponse;
}

const HUES = [210, 160, 280, 25, 130, 340, 55, 190];

/**
 * Tag-style “word cloud” for precomputed PROJECT_TERMS theme masses
 * (`GET /analytics/project-term-theme-cloud` → notebook-generated JSON).
 *
 * Implemented without the `wordcloud` npm package so Docker/Vite always resolve
 * (anonymous `node_modules` volumes often miss optional deps).
 */
export default function ProjectTermsThemeCloud({ payload }: ProjectTermsThemeCloudProps) {
  const buckets: ThemeBucket[] = payload.buckets ?? [];
  const maxW = Math.max(...buckets.map((b) => b.weight), 1);

  return (
    <div className="chart-panel chart-panel--term-cloud">
      <div className="chart-panel-header chart-panel-header--row">
        <h3 className="chart-panel-title">Project term themes</h3>
        {payload.generated_at ? (
          <span className="chart-panel-meta">Updated {payload.generated_at}</span>
        ) : null}
      </div>
      <p className="chart-panel-note">
        Each label is an <strong>umbrella theme</strong>; size reflects how many{" "}
        <code className="chart-inline-code">;</code>-split term hits were assigned to that theme
        (nearest anchor embedding in the notebook). Edit anchors in the notebook, re-run the cell,
        then refresh the dashboard.
      </p>
      {buckets.length === 0 ? (
        <p className="chart-panel-empty">
          {payload.message ??
            "No theme data yet. Run the embedding theme cell in proj_data_analysis.ipynb — it writes project_term_theme_counts.json next to the notebook — then reload."}
        </p>
      ) : (
        <div className="term-theme-cloud" aria-label="Theme word cloud">
          {buckets.map((b, i) => {
            const t = b.weight / maxW;
            const fontRem = 0.95 + t * 1.65;
            const hue = HUES[i % HUES.length];
            return (
              <span
                key={b.label}
                className="term-theme-cloud__tag"
                style={{
                  fontSize: `${fontRem}rem`,
                  color: `hsl(${hue} 48% 32%)`,
                  backgroundColor: `hsl(${hue} 42% 96%)`,
                }}
                title={`${b.weight.toLocaleString()} term hits`}
              >
                {b.label}
                <span className="term-theme-cloud__count">{b.weight.toLocaleString()}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
