import { useRef, useState } from "react";
import { scaleSequential } from "d3-scale";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import type { Geography as GeographyType } from "react-simple-maps";
import type { StateDataPoint } from "../api";

/** TopoJSON source — US states at 1:10m resolution */
const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

/**
 * Maps 2-letter USPS abbreviations to the full state name used in
 * the us-atlas TopoJSON `properties.name` field.
 */
const STATE_ABBREV_TO_NAME: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

/**
 * Linear interpolation between two hex colors.
 * `t` should be in [0, 1].
 */
function interpolateHex(colorA: string, colorB: string, t: number): string {
  const parseHex = (hex: string): [number, number, number] => {
    const cleaned = hex.replace("#", "");
    return [
      parseInt(cleaned.slice(0, 2), 16),
      parseInt(cleaned.slice(2, 4), 16),
      parseInt(cleaned.slice(4, 6), 16),
    ];
  };

  const toHex = (n: number): string => Math.round(n).toString(16).padStart(2, "0");

  const [r1, g1, b1] = parseHex(colorA);
  const [r2, g2, b2] = parseHex(colorB);

  return `#${toHex(r1 + (r2 - r1) * t)}${toHex(g1 + (g2 - g1) * t)}${toHex(b1 + (b2 - b1) * t)}`;
}

interface TooltipState {
  stateName: string;
  count: number;
  totalFunding: number;
}

interface StateMapProps {
  data: StateDataPoint[];
}

const formatFunding = (n: number): string => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n}`;
};

/**
 * US choropleth map shaded by total NIH grant funding per state.
 * Uses react-simple-maps + d3-scale for the color scale.
 */
export default function StateMap({ data }: StateMapProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const updateTooltipPosition = (x: number, y: number): void => {
    const el = tooltipRef.current;
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  };

  // Build lookup from full state name → data point
  const stateByName = new Map<string, StateDataPoint>();
  for (const point of data) {
    const fullName = STATE_ABBREV_TO_NAME[point.state.toUpperCase()];
    if (fullName) {
      stateByName.set(fullName, point);
    }
  }

  const maxFunding = Math.max(...data.map((d) => d.total_funding), 1);

  // d3-scale sequential scale (domain 0→max, output 0→1 for our interpolator)
  const colorScale = scaleSequential<number>()
    .domain([0, maxFunding])
    .range([0, 1] as unknown as [number, number]);

  const getFill = (geoName: string): string => {
    const point = stateByName.get(geoName);
    if (!point) return "var(--border)";
    const t = colorScale(point.total_funding) as unknown as number;
    return interpolateHex("#dbeafe", "#1a56db", Math.min(1, Math.max(0, t)));
  };

  return (
    <div className="chart-panel" style={{ position: "relative" }}>
      <div className="chart-panel-title">Funding by State</div>
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{ scale: 900 }}
        width={800}
        height={500}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: GeographyType[] }) =>
            geographies.map((geo) => {
              const geoName = geo.properties.name as string;
              const point = stateByName.get(geoName);

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={getFill(geoName)}
                  stroke="var(--surface)"
                  strokeWidth={1}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", filter: "brightness(0.88)" },
                    pressed: { outline: "none" },
                  }}
                  onMouseEnter={(e) => {
                    updateTooltipPosition(e.clientX + 12, e.clientY - 8);
                    setTooltip({
                      stateName: geoName,
                      count: point?.count ?? 0,
                      totalFunding: point?.total_funding ?? 0,
                    });
                  }}
                  onMouseMove={(e) => {
                    updateTooltipPosition(e.clientX + 12, e.clientY - 8);
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {tooltip && (
        <div
          ref={tooltipRef}
          className="map-tooltip"
          style={{ left: 0, top: 0 }}
        >
          <div className="map-tooltip-state">{tooltip.stateName}</div>
          <div className="map-tooltip-row">Projects: {tooltip.count.toLocaleString()}</div>
          <div className="map-tooltip-row">Funding: {formatFunding(tooltip.totalFunding)}</div>
        </div>
      )}
    </div>
  );
}
