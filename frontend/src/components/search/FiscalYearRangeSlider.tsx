import { useCallback, useEffect, useMemo, useState } from "react";
import ReactSlider from "react-slider";
import { cn } from "../../utils/cn";
import {
  fiscalYearIndicesToFilterValues,
  resolveFiscalYearSliderIndices,
} from "../../utils/fiscalYearRange";

type FiscalYearRangeSliderProps = {
  choices: readonly number[];
  fyMin: string;
  fyMax: string;
  onChange: (fyMin: string, fyMax: string) => void;
  /** Fired when the user releases a thumb or commits a text input. */
  onCommit?: (fyMin: string, fyMax: string) => void;
};

function FiscalYearRangeSlider({
  choices,
  fyMin,
  fyMax,
  onChange,
  onCommit,
}: FiscalYearRangeSliderProps) {
  const sliderIndices = useMemo(
    () => resolveFiscalYearSliderIndices(fyMin, fyMax, choices),
    [choices, fyMin, fyMax],
  );

  const [loIndex, hiIndex] = sliderIndices;
  const displayMin = String(choices[loIndex] ?? "");
  const displayMax = String(choices[hiIndex] ?? "");

  const indicesToValues = useCallback(
    (nextLo: number, nextHi: number) => fiscalYearIndicesToFilterValues(nextLo, nextHi, choices),
    [choices],
  );

  const handleSliderChange = useCallback(
    (value: number | readonly number[]) => {
      const [nextLo, nextHi] = value as number[];
      const next = indicesToValues(nextLo, nextHi);
      onChange(next.fyMin, next.fyMax);
    },
    [indicesToValues, onChange],
  );

  const handleSliderCommit = useCallback(
    (value: number | readonly number[]) => {
      if (!onCommit) return;
      const [nextLo, nextHi] = value as number[];
      const next = indicesToValues(nextLo, nextHi);
      onCommit(next.fyMin, next.fyMax);
    },
    [indicesToValues, onCommit],
  );

  const commitYearInput = useCallback(
    (raw: string, bound: "min" | "max") => {
      const parsed = Number.parseInt(raw.trim(), 10);
      if (!Number.isFinite(parsed) || choices.length === 0) {
        return;
      }
      const year = choices.includes(parsed)
        ? parsed
        : choices.reduce((nearest, y) => (
          Math.abs(y - parsed) < Math.abs(nearest - parsed) ? y : nearest
        ), choices[0]);
      const yearIndex = choices.indexOf(year);
      const nextLo = bound === "min" ? yearIndex : loIndex;
      const nextHi = bound === "max" ? yearIndex : hiIndex;
      const next = indicesToValues(nextLo, nextHi);
      onChange(next.fyMin, next.fyMax);
      onCommit?.(next.fyMin, next.fyMax);
    },
    [choices, hiIndex, indicesToValues, loIndex, onChange, onCommit],
  );

  if (choices.length === 0) {
    return null;
  }

  const sliderMax = Math.max(choices.length - 1, 0);

  return (
    <div className="relative flex w-full min-h-[2rem] mt-2 items-end">
      <div className="absolute bottom-full left-0 right-0 mt-0 w-full">
        <ReactSlider
        className="relative h-1 w-full"
        thumbClassName="top-1/2 z-[2] size-4 -translate-y-1/2 cursor-grab rounded-full border-2 border-accent bg-bg shadow-sm outline-none transition-[box-shadow,transform] duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent/40 active:cursor-grabbing"
        trackClassName="top-1/2 h-1.5 -translate-y-1/2 rounded-full"
        value={sliderIndices}
        min={0}
        max={sliderMax}
        step={1}
        minDistance={0}
        pearling
        onChange={handleSliderChange}
        onAfterChange={handleSliderCommit}
        renderTrack={(props, state) => (
          <div
            {...props}
            className={cn(
              "top-1/2 h-1.5 -translate-y-1/2 rounded-full",
              state.index === 1 ? "bg-accent" : "bg-accent/25",
            )}
          />
        )}
        ariaLabel={["Minimum fiscal year", "Maximum fiscal year"]}
        ariaValuetext={(state) => String(choices[state.valueNow] ?? state.valueNow)}
        />
      </div>
      <YearBoundInputs
        displayMin={displayMin}
        displayMax={displayMax}
        onCommitMin={(raw) => commitYearInput(raw, "min")}
        onCommitMax={(raw) => commitYearInput(raw, "max")}
      />
    </div>
  );
}

type YearBoundInputsProps = {
  displayMin: string;
  displayMax: string;
  onCommitMin: (raw: string) => void;
  onCommitMax: (raw: string) => void;
};

function YearBoundInputs({
  displayMin,
  displayMax,
  onCommitMin,
  onCommitMax,
}: YearBoundInputsProps) {
  const [minInput, setMinInput] = useState(displayMin);
  const [maxInput, setMaxInput] = useState(displayMax);

  useEffect(() => {
    setMinInput(displayMin);
  }, [displayMin]);

  useEffect(() => {
    setMaxInput(displayMax);
  }, [displayMax]);

  const yearInputClassName =
    "box-border h-6 w-[3.25rem] shrink-0 rounded-sm border border-border bg-bg px-0 py-0 text-center font-sans text-[13px] leading-none text-text-primary outline-none transition-[border-color] duration-150 hover:border-accent/40 focus:border-accent";

  return (
    <div className="flex w-full items-center justify-center gap-1.5">
      <input
        type="text"
        inputMode="numeric"
        aria-label="Fiscal year from"
        className={yearInputClassName}
        value={minInput}
        onChange={(e) => setMinInput(e.target.value)}
        onBlur={() => onCommitMin(minInput)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommitMin(minInput);
          }
        }}
      />
      <span className="shrink-0 text-[13px] text-text-muted" aria-hidden>
        –
      </span>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Fiscal year to"
        className={yearInputClassName}
        value={maxInput}
        onChange={(e) => setMaxInput(e.target.value)}
        onBlur={() => onCommitMax(maxInput)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommitMax(maxInput);
          }
        }}
      />
    </div>
  );
}

export default FiscalYearRangeSlider;
