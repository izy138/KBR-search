import { useRef, useState } from "react";
import { scaleThreshold } from "d3-scale";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import type { Geography as GeographyType } from "react-simple-maps";
import type { StateDataPoint } from "../api";

/** TopoJSON source — US states at 1:10m resolution */
const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

/** GeoJSON source — Puerto Rico (not included in us-atlas states) */
const PR_GEO_URL =
  "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";

/** Project-count thresholds for choropleth buckets */
const COUNT_THRESHOLDS = [1000, 5000, 10000, 20000, 30000, 40000, 50000] as const;

/** Eight-step choropleth — mint → navy */
const MAP_COLOR_STOPS = [
  "#c0f0c4", // 0–1k #88c292 #7DB888
  "#9ce6a7", // 1k–5k — medium green
  "#72d497", // 5k–10k — clear teal shift #3A9EAA
  "#3eb896", //10k–20k
  "#18888c", //20k–30k
  "#1c708f", //30k–40k
  "#195182", //40k–50k
  "#0d3763", // 50k+
] as const;
const HOVER_FILL = "#ffe259";
const HOVER_STROKE = "#f97316";

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
  PR: "Puerto Rico",
};

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
 * US choropleth map shaded by NIH project count per state.
 * Uses react-simple-maps + d3-scale for the color scale.
 */
export default function StateMap({ data }: StateMapProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
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

  const colorScale = scaleThreshold<string>()
    .domain([...COUNT_THRESHOLDS])
    .range([...MAP_COLOR_STOPS]);

  const getFill = (geoName: string): string => {
    const point = stateByName.get(geoName);
    if (!point) return MAP_COLOR_STOPS[0];
    return colorScale(point.count);
  };

  const renderGeography = (geo: GeographyType, hoveredLayer = false): JSX.Element => {
    const geoName = geo.properties.name as string;
    const point = stateByName.get(geoName);
    const isHovered = hoveredLayer || hoveredState === geoName;

    return (
      <Geography
        key={hoveredLayer ? `${geo.rsmKey}-hover` : geo.rsmKey}
        geography={geo}
        fill={isHovered ? HOVER_FILL : getFill(geoName)}
        stroke={isHovered ? HOVER_STROKE : "#ffffff"}
        strokeWidth={isHovered ? 3 : 1}
        style={{
          default: {
            outline: "none",
            transition: "fill 0.15s ease, stroke 0.15s ease",
            strokeLinejoin: "round",
            strokeLinecap: "round",
          },
          hover: { outline: "none" },
          pressed: { outline: "none" },
        }}
        onMouseEnter={(e) => {
          setHoveredState(geoName);
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
        onMouseLeave={() => {
          setHoveredState(null);
          setTooltip(null);
        }}
      />
    );
  };

  const renderGeographyLayers = (geographies: GeographyType[]): JSX.Element[] => {
    const geoName = (geo: GeographyType): string => geo.properties.name as string;

    const baseLayer = geographies
      .filter((geo) => geoName(geo) !== hoveredState)
      .map((geo) => renderGeography(geo));

    const hoverLayer = hoveredState
      ? geographies
          .filter((geo) => geoName(geo) === hoveredState)
          .map((geo) => renderGeography(geo, true))
      : [];

    return [...baseLayer, ...hoverLayer];
  };

  return (
    <div className="chart-panel state-map-panel">
      <div className="chart-panel-title">Projects by State</div>
      <div className="state-map-canvas">
        <ComposableMap
          projection="geoAlbersUsa"
          projectionConfig={{ scale: 900 }}
          width={700}
          height={500}
          style={{ width: "100%", height: "auto" }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: GeographyType[] }) =>
              renderGeographyLayers(geographies)
            }
          </Geographies>
        </ComposableMap>

        <div className="state-map-pr-inset">
          <ComposableMap
            projection="geoConicEqualArea"
            projectionConfig={{
              rotate: [66, 0],
              center: [0, 18],
              parallels: [8, 18],
              scale: 3400,
            }}
            width={26}
            height={16}
          >
            <Geographies geography={PR_GEO_URL}>
              {({ geographies }: { geographies: GeographyType[] }) =>
                renderGeographyLayers(
                  geographies.filter((geo) => (geo.properties.name as string) === "Puerto Rico"),
                )
              }
            </Geographies>
          </ComposableMap>
        </div>
      </div>

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
