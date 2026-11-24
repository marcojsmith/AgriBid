import { cn } from "@/lib/utils";

/** Which identity document the buyer registers with. */
export type IdType = "sa_id" | "passport";

interface IdTypeToggleProps {
  value: IdType;
  onChange: (value: IdType) => void;
  className?: string;
}

const OPTIONS: readonly { value: IdType; label: string }[] = [
  { value: "sa_id", label: "SA ID" },
  { value: "passport", label: "Passport" },
];

/**
 * Two full-width 48px buttons that pick SA ID or Passport on registration
 * step 1. The selected one is filled `primary`, the other is outlined; each
 * has `aria-pressed`.
 *
 * @param props - Component props
 * @param props.value - The selected ID type
 * @param props.onChange - Called with the newly chosen type
 * @param props.className - Extra classes merged onto the group
 * @returns The toggle
 */
export function IdTypeToggle({
  value,
  onChange,
  className,
}: IdTypeToggleProps) {
  return (
    <div
      role="group"
      aria-label="ID type"
      data-slot="id-type-toggle"
      className={cn("mb-3.5 flex w-full gap-2", className)}
    >
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              onChange(option.value);
            }}
            className={cn(
              "min-h-12 flex-1 rounded-md border px-3 text-base font-medium transition-colors",
              selected
                ? "border-btn bg-btn text-btn-foreground"
                : "border-border bg-card text-foreground hover:bg-accent"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
