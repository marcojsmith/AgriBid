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
  padding?: "p-4" | "p-6";
  bgVariant?: "bg-card/30" | "bg-card/50";
  iconSize?: "h-10 w-10" | "h-12 w-12";
}

/**
 * Renders a compact statistic card showing a label, a prominent value, and an icon.
 *
 * @param props - Component properties including label, value, icon, and optional styling
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
    <Card className={cn(
      padding, 
      "border-2 flex items-center justify-between backdrop-blur-sm", 
      bgVariant,
      className
    )}>
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
          {label}
        </p>
        <p className={cn("text-2xl font-black", color)}>{value}</p>
      </div>
      <div className={cn(
        iconSize, 
        "rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground"
      )}>
        {icon}
      </div>
    </Card>
  );
}
