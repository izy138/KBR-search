import type { FC, ReactNode } from "react";
import { cn } from "../../utils/cn";

type FilterFieldProps = {
  label?: string;
  children: ReactNode;
  className?: string;
};

const FilterField: FC<FilterFieldProps> = ({ label, children, className }) => (
  <div className={cn("flex min-w-0 flex-col", className)}>
    {label ? (
      <div className="mb-[0.38rem] whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
        {label}
      </div>
    ) : null}
    {children}
  </div>
);

export default FilterField;
