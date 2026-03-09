import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  title: string;
  icon: React.ReactNode;
  stats: {
    label: string;
    value: string | number;
    color?: string;
  }[];
  link: string;
  linkLabel: string;
  className?: string;
}

/**
 * A card component that displays a summary of statistics and a link to more details.
 *
 * @param props - Component props
 * @param props.title - The title of the summary card
 * @param props.icon - An icon to display next to the title
 * @param props.stats - An array of statistics objects to display
 * @param props.link - The URL to link to for more details
 * @param props.linkLabel - The text label for the link
 * @param props.className - Additional CSS classes
 * @returns A summary card component
 */
export function SummaryCard({
  title,
  icon,
  stats,
  link,
  linkLabel,
  className,
}: SummaryCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden border-2 group transition-all hover:shadow-xl hover:shadow-primary/5 h-full flex flex-col",
        className
      )}
    >
      <div className="p-6 flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              {icon}
            </div>
            <h3 className="font-black uppercase tracking-tight text-lg">
              {title}
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {stats.map((stat, idx) => (
            <div key={idx} className="space-y-1">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">
                {stat.label}
              </p>
              <p className={cn("text-2xl font-black tabular-nums", stat.color)}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <Link
          to={link}
          className="flex items-center justify-between py-2 px-3 -mx-1 rounded-xl hover:bg-muted transition-colors text-xs font-bold text-muted-foreground hover:text-foreground group/link mt-auto"
        >
          {linkLabel}
          <ChevronRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" />
        </Link>
      </div>
    </Card>
  );
}
