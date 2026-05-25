import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

type FiscalYearTagProps = {
  active?: boolean;
  compact?: boolean;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
};

export default function FiscalYearTag({ active, compact, className: classNameProp, onClick, children }: FiscalYearTagProps) {
  const className = cn(
    "inline-flex items-center rounded-full border font-sans font-semibold leading-[1.2]",
    compact ? "px-2 py-[0.15rem] text-[0.72rem]" : "px-[0.65rem] py-[0.2rem] text-[0.78rem]",
    active
      ? "border-green bg-green text-surface cursor-default"
      : "border-border-strong bg-green-light text-green cursor-pointer hover:border-green hover:brightness-[0.97]",
    classNameProp,
  );

  if (active) {
    return (
      <span className={className} aria-current="page">
        {children}
      </span>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}
