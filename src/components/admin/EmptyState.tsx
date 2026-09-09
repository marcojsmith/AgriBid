// app/src/components/admin/EmptyState.tsx
import React from "react";

/**
 * Render a stylized empty-state placeholder with an icon, a primary label, and a subtitle.
 *
 * @param label.label
 * @param label - Primary label text shown below the icon
 * @param icon - Icon node rendered inside the circular icon container
 * @param subtitle - Secondary subtitle shown beneath the label; defaults to "Operational Equilibrium Reached"
 * @param label.icon
 * @param label.subtitle
 * @returns The empty-state JSX element containing the icon, label, and subtitle
 */
export function EmptyState({
  label,
  icon,
  subtitle = "Operational Equilibrium Reached",
}: {
  label: string;
  icon: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="bg-card/30 border border-dashed rounded-lg p-20 text-center space-y-4">
      <div className="h-16 w-16 rounded-md bg-primary/5 flex items-center justify-center mx-auto text-primary/30 border border-primary/10">
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="text-xl font-semibold tracking-tight">{label}</h3>
        <p className="text-muted-foreground font-medium text-xs">{subtitle}</p>
      </div>
    </div>
  );
}
