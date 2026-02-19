// app/src/components/kyc/ListItem.tsx
import { Check } from "lucide-react";

/**
 * Renders a list item with a check icon and the given label styled for compliance rules.
 *
 * @param text - The label to display next to the check icon
 * @returns A React element for the list item
 */
export function ListItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-[11px] font-bold uppercase text-muted-foreground leading-tight">
      <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
      {text}
    </li>
  );
}
