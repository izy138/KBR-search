import { cn } from "../../utils/cn";

type BackToResultsButtonProps = {
  onClick: () => void;
  className?: string;
};

const CLS_BACK =
  "inline-flex items-center gap-[0.3rem] p-0 border-none bg-transparent text-accent font-sans text-[15.5px] cursor-pointer hover:underline";

export default function BackToResultsButton({ onClick, className }: BackToResultsButtonProps) {
  return (
    <button type="button" className={cn(CLS_BACK, className)} onClick={onClick}>
      <span className="text-[1.05em] leading-none" aria-hidden="true">
        ←
      </span>
      Back to results
    </button>
  );
}
