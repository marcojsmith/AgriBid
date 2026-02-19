// app/src/components/admin/DetailItem.tsx
import React from "react";

/**
 * Renders a labeled detail item with an icon and value.
 *
 * @param label - The label for the detail item
 * @param value - The value to display
 * @param icon - The icon to display next to the label
 * @returns A React element for the detail item
 */
export function DetailItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
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
          {value ?? "Not Provided"}
        </p>
      </div>
    </div>
  );
}
