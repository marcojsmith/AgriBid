import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface NumberedStepsProps {
  /** One node per step, in order. */
  steps: readonly ReactNode[];
  className?: string;
}

/**
 * An ordered list whose numbers are 28px rounded squares (4px radius) in
 * `primary-soft` with a `primary` figure: "If you win" steps and the Add to
 * Home Screen sheet. Squares, never circles.
 *
 * @param props - Component props
 * @param props.steps - One node per step
 * @param props.className - Extra classes merged onto the list
 * @returns The list
 */
export function NumberedSteps({ steps, className }: NumberedStepsProps) {
  return (
    <ol
      data-slot="numbered-steps"
      className={cn("m-0 list-none p-0", className)}
    >
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 py-1.5 text-[15px] leading-snug">
          <span
            aria-hidden="true"
            className="num mt-px flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-sm font-bold text-primary"
          >
            {i + 1}
          </span>
          <span className="self-center">{step}</span>
        </li>
      ))}
    </ol>
  );
}
