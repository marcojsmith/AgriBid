import { AlertTriangle, Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/** Condition checklist as stored on a lot (`conditionChecklist`). */
export interface ConditionChecklistInput {
  engine?: boolean;
  hydraulics?: boolean;
  tires?: boolean;
  serviceHistory?: boolean;
  notes?: string;
}

interface ConditionReportProps {
  checklist?: ConditionChecklistInput | null;
  /** Link to the full inspection PDF, when there is one. */
  pdfHref?: string;
  className?: string;
}

/**
 * Condition rows with an icon and text (never colour alone): Good, Wear
 * noted or Not reported, plus the seller's notes and an optional PDF link.
 *
 * Use it on the lot page. A missing value is "Not reported", not "Good".
 *
 * @param props - Component props
 * @param props.checklist - Condition checklist from the lot; missing values show "Not reported"
 * @param props.pdfHref - Link to the full inspection PDF, if there is one
 * @param props.className - Extra classes merged onto the root element
 * @returns The condition report
 */
export function ConditionReport({
  checklist,
  pdfHref,
  className,
}: ConditionReportProps) {
  const notes = checklist?.notes?.trim();
  const items = [
    { label: "Engine", value: checklist?.engine },
    { label: "Hydraulics", value: checklist?.hydraulics },
    { label: "Tyres", value: checklist?.tires },
    { label: "Service history", value: checklist?.serviceHistory },
  ];
  return (
    <div data-slot="condition-report" className={cn("text-sm", className)}>
      <ul className="divide-y divide-border">
        {items.map(({ label, value }) => {
          const [text, Icon, tone] =
            value === true
              ? (["Good", Check, "text-ok-fg"] as const)
              : value === false
                ? (["Wear noted", AlertTriangle, "text-warn-fg"] as const)
                : (["Not reported", Minus, "text-muted-foreground"] as const);
          return (
            <li key={label} className="flex items-center justify-between py-2">
              <span>{label}</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 font-medium",
                  tone
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {text}
              </span>
            </li>
          );
        })}
      </ul>
      {notes ? (
        <p className="mt-3 text-muted-foreground">
          <span className="font-medium text-foreground">Seller notes: </span>
          {notes}
        </p>
      ) : null}
      {pdfHref ? (
        <a
          href={pdfHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
        >
          Inspection report (PDF)
        </a>
      ) : null}
    </div>
  );
}
