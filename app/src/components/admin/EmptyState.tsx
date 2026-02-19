// app/src/components/admin/EmptyState.tsx
import React from "react";

/**
 * Displays a stylized empty-state placeholder containing an icon and a label.
 *
 * @param label - Primary uppercase label text shown below the icon
 * @param icon - Icon node rendered inside the circular icon container
 * @returns The placeholder element showing the provided icon and label
 */
export function EmptyState({ 
  label, 
  icon, 
  subtitle = "Operational Equilibrium Reached" 
}: { 
  label: string; 
  icon: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="bg-card/30 border-2 border-dashed rounded-3xl p-20 text-center space-y-4">
      <div className="h-16 w-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto text-primary/30 border-2 border-primary/10">
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="text-xl font-black uppercase tracking-tight">{label}</h3>
        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em]">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
