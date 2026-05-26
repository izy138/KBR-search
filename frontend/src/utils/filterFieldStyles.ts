import { cn } from "./cn";

/** Active dashboard filter — accent border, darker blue fill, pulsing accent glow. */
export const CLS_FILTER_CONTROL_ACTIVE = cn(
  "!border-accent bg-accent/80 text-text-primary dark:bg-accent/45",
  "animate-filter-selected-pulse",
  "hover:!border-accent focus:!border-accent",
);
