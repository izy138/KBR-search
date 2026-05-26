import type { FC, ReactNode } from "react";
import HelpTooltip from "../shared/HelpTooltip";
import { cn } from "../../utils/cn";
import type { HelpTooltipContent } from "../../utils/helpContent";

type FilterFieldProps = {
  label?: string;
  help?: HelpTooltipContent;
  children: ReactNode;
  className?: string;
};

const FilterField: FC<FilterFieldProps> = ({ label, help, children, className }) => (
  <div className={cn("flex min-w-0 flex-col", className)}>
    {label ? (
      <div className="mb-[0.38rem] flex items-center gap-1">
        <span className="whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.06em] text-text-muted">
          {label}
        </span>
        {help ? (
          <HelpTooltip label={help.label}>
            {help.body}
          </HelpTooltip>
        ) : null}
      </div>
    ) : null}
    {children}
  </div>
);

export default FilterField;
