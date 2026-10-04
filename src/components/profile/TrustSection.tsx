import { ShieldCheck } from "lucide-react";

import type { TrustItem } from "@/types/profile";

interface TrustSectionProps {
  /** Array of trust items to display */
  trustItems: TrustItem[];
}

/**
 * Renders the Trust & Compliance section with verification status grid.
 *
 * @param props - Component props
 * @param props.trustItems - Array of trust items to display
 * @returns A section with trust and compliance information
 */
export function TrustSection({ trustItems }: TrustSectionProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-bold text-primary">Trust & Compliance</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {trustItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="border border-border rounded p-4 text-center"
            >
              <Icon
                className={`h-5 w-5 mx-auto mb-2 ${
                  item.verified ? "text-success" : "text-warning"
                }`}
              />
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                {item.label}
              </p>
              <p
                className={`text-xs font-bold ${
                  item.verified ? "text-success" : "text-warning"
                }`}
              >
                {item.value}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
