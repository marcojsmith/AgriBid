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
 * Render an interactive settings card showing an icon, title, and description.
 *
 * The card invokes the provided `action` when activated (click or Enter/Space) and exposes a button role with an ARIA label composed from the title and description.
 *
 * @param root0 - Component props
 * @param root0.title - Visible card title
 * @param root0.description - Supporting description shown below the title
 * @param root0.icon - Visual node rendered in the icon container
 * @param root0.action - Callback invoked when the card is activated
 * @returns A Card element that visually represents the setting and invokes `action` on activation
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
      className="p-6 border hover:border-primary/40 transition-all cursor-pointer group flex flex-col justify-between h-48 bg-card/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      onClick={action}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${title}: ${description}`}
    >
      <div className="space-y-3">
        <div className="h-12 w-12 rounded-md bg-muted group-hover:bg-primary/10 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-all border">
          {icon}
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </Card>
  );
}
