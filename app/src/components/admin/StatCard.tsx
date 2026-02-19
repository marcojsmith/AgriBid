// app/src/components/admin/StatCard.tsx
import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Renders a compact statistic card showing a label, a prominent value, and an icon.
 *
 * @param label - Short uppercase label displayed above the value
 * @param value - Numeric or string statistic shown prominently
 * @param icon - Visual icon displayed on the right side of the card
 * @param color - Optional CSS class applied to the value for color/styling
 * @returns A Card element containing the labeled statistic and icon
 */
export function StatCard({
  label,
  value,
  icon,
  color = "",
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <Card className="p-4 border-2 flex items-center justify-between bg-card/30 backdrop-blur-sm">
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
          {label}
        </p>
        <p className={cn("text-2xl font-black", color)}>{value}</p>
      </div>
      <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
    </Card>
  );
}
