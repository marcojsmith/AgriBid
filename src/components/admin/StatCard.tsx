// app/src/components/admin/StatCard.tsx
import React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: string;
  className?: string;
  padding?: "p-2" | "p-4" | "p-6";
  bgVariant?: "bg-card/30" | "bg-card/50";
  iconSize?: "h-8 w-8" | "h-10 w-10" | "h-12 w-12";
}

/**
 * Renders a compact statistic card showing a label, a prominent value, and an icon.
 *
 * @param root0 - Component properties including label, value, icon, and optional styling
 * @param root0.label - Statistic label shown above the value
 * @param root0.value - Statistic value displayed prominently
 * @param root0.icon - Icon node rendered on the right side of the card
 * @param root0.color - Optional text color class applied to the value
 * @param root0.className - Optional additional classes merged onto the card
 * @param root0.padding - Padding variant for the card; defaults to "p-4"
 * @param root0.bgVariant - Background variant of the card; defaults to "bg-card/30"
 * @param root0.iconSize - Size classes for the icon container; defaults to "h-10 w-10"
 * @returns A Card element containing the labeled statistic and icon
 */
export function StatCard({
  label,
  value,
  icon,
  color = "",
  className,
  padding = "p-4",
  bgVariant = "bg-card/30",
  iconSize = "h-10 w-10",
}: StatCardProps) {
  return (
    <Card
      className={cn(
        padding,
        "border flex items-center justify-between backdrop-blur-sm",
        bgVariant,
        className
      )}
    >
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-bold", color)}>{value}</p>
      </div>
      <div
        className={cn(
          iconSize,
          "rounded-md bg-muted/50 flex items-center justify-center text-muted-foreground"
        )}
      >
        {icon}
      </div>
    </Card>
  );
}
