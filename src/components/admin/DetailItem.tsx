// app/src/components/admin/DetailItem.tsx
import React from "react";

/**
 * Render a labeled detail row with an icon and a value.
 *
 * @param props - Component props.
 * @param props.label - Text label displayed above the value
 * @param props.value - Value to display; if `null`, `undefined`, or an empty string, displays "Not Provided"
 * @param props.icon - Icon element shown inside the square icon container
 * @returns The detail item as a React element
 */
export function DetailItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground border">
        {icon}
      </div>
      <div>
        <p className="text-[8px] font-black uppercase text-muted-foreground leading-none mb-0.5">
          {label}
        </p>
        <p className="text-sm font-bold tracking-tight">
          {value || "Not Provided"}
        </p>
      </div>
    </div>
  );
}
