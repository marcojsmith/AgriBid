// app/src/components/admin/SettingsCard.tsx
import React from "react";
import { Card } from "@/components/ui/card";

export interface SettingsCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
}

/**
 * Renders an interactive settings card that displays an icon, title, and description and invokes an action when clicked.
 *
 * @param props - Component properties
 * @returns A Card element containing the provided icon, title, and description that calls `action` on click or key press
 */
export function SettingsCard({
  title,
  description,
  icon,
  action,
}: SettingsCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };

  return (
    <Card
      className="p-6 border-2 hover:border-primary/40 transition-all cursor-pointer group flex flex-col justify-between h-48 bg-card/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      onClick={action}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${title}: ${description}`}
    >
      <div className="space-y-3">
        <div className="h-12 w-12 rounded-2xl bg-muted group-hover:bg-primary/10 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-all border-2">
          {icon}
        </div>
        <div className="space-y-1">
          <h3 className="font-black uppercase tracking-tight text-lg">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </Card>
  );
}
